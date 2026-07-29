import { Injectable } from '@nestjs/common';
import type {
  EInvoiceCredential,
  EInvoiceDocStatus,
  EInvoiceDocument,
  EInvoiceSettings,
  Prisma,
} from '@prisma/client';
import { TenantRepository } from '../common/tenant.repository';
import { withPlatform, withTenant, type TxClient } from '../prisma/tenant.helpers';
import { TenantContextStore } from '../prisma/tenant-context';

/** Retry/backoff schedule for transient submission failures (then DEAD_LETTER). */
export const RETRY_BACKOFF_MS = [60_000, 300_000, 1_500_000, 7_200_000, 43_200_000];

export class InvalidDocumentStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDocumentStateError';
  }
}

@Injectable()
export class EInvoicingRepository extends TenantRepository {
  // ---------------------------------------------------------------- settings

  getOrCreateSettings(): Promise<EInvoiceSettings> {
    return this.run(async (tx, tenantId) => {
      const existing = await tx.eInvoiceSettings.findUnique({ where: { tenantId } });
      if (existing) return existing;
      return tx.eInvoiceSettings.create({ data: { tenantId } });
    });
  }

  updateSettings(
    data: Omit<Prisma.EInvoiceSettingsUncheckedUpdateInput, 'id' | 'tenantId'>,
  ): Promise<EInvoiceSettings> {
    return this.run(async (tx, tenantId) => {
      await tx.eInvoiceSettings.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
      return tx.eInvoiceSettings.update({ where: { tenantId }, data });
    });
  }

  saveCredential(data: {
    clientId: string;
    secretEncrypted: string;
    secretHint: string;
    incomeSourceSequence: string;
    deviceLabel: string | null;
  }): Promise<EInvoiceCredential> {
    return this.run(async (tx, tenantId) => {
      const settings = await tx.eInvoiceSettings.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
      // One active device at a time (a new registration supersedes the previous).
      await tx.eInvoiceCredential.updateMany({
        where: { settingsId: settings.id, isActive: true },
        data: { isActive: false },
      });
      const created = await tx.eInvoiceCredential.create({
        data: { ...data, tenantId, settingsId: settings.id },
      });
      await this.writeAudit(tx, tenantId, {
        action: 'einvoice.credential.saved',
        entityType: 'EInvoiceCredential',
        entityId: created.id,
        metadata: { clientId: data.clientId, deviceLabel: data.deviceLabel }, // never the secret
      });
      return created;
    });
  }

  activeCredential(): Promise<EInvoiceCredential | null> {
    return this.run((tx, tenantId) =>
      tx.eInvoiceCredential.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  recordConnectionTest(ok: boolean): Promise<EInvoiceSettings> {
    return this.run((tx, tenantId) =>
      tx.eInvoiceSettings.update({
        where: { tenantId },
        data: { lastTestAt: new Date(), lastTestOk: ok },
      }),
    );
  }

  // --------------------------------------------------------------- documents

  createDraft(
    data: Omit<Prisma.EInvoiceDocumentUncheckedCreateInput, 'tenantId' | 'status'>,
  ): Promise<EInvoiceDocument> {
    return this.run(async (tx, tenantId) => {
      const doc = await tx.eInvoiceDocument.create({
        data: { ...data, tenantId, status: 'DRAFT' },
      });
      await this.log(tx, tenantId, doc.id, 'CREATED');
      return doc;
    });
  }

  findDocument(id: string): Promise<EInvoiceDocument | null> {
    return this.run((tx, tenantId) =>
      tx.eInvoiceDocument.findFirst({
        where: { id, tenantId },
        include: { logs: { orderBy: { createdAt: 'asc' } } },
      }),
    );
  }

  listDocuments(filter: {
    status?: EInvoiceDocStatus;
    take?: number;
  }): Promise<EInvoiceDocument[]> {
    return this.run((tx, tenantId) =>
      tx.eInvoiceDocument.findMany({
        where: { tenantId, ...(filter.status ? { status: filter.status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Math.min(filter.take ?? 50, 200),
      }),
    );
  }

  /**
   * DRAFT → QUEUED, allocating the gapless ICV from the row-locked per-tenant counter
   * in the SAME transaction (the compliance requirement: sequential, no gaps/dupes).
   */
  queueDocument(id: string): Promise<EInvoiceDocument> {
    return this.run(async (tx, tenantId) => {
      const doc = await tx.eInvoiceDocument.findFirst({ where: { id, tenantId } });
      if (!doc) throw new InvalidDocumentStateError('Document not found');
      if (doc.status !== 'DRAFT') {
        throw new InvalidDocumentStateError(`Cannot queue a ${doc.status} document`);
      }
      // Row-lock the counter; create it lazily on first use.
      await tx.$executeRaw`INSERT INTO "EInvoiceCounter" ("id","tenantId") VALUES (gen_random_uuid(), ${tenantId}::uuid) ON CONFLICT ("tenantId") DO NOTHING`;
      const rows = await tx.$queryRaw<{ nextIcv: bigint }[]>`
        UPDATE "EInvoiceCounter" SET "nextIcv" = "nextIcv" + 1
        WHERE "tenantId" = ${tenantId}::uuid
        RETURNING "nextIcv" - 1 AS "nextIcv"`;
      const icv = rows[0]!.nextIcv;
      const updated = await tx.eInvoiceDocument.update({
        where: { id },
        data: {
          status: 'QUEUED',
          icv,
          issuedAt: doc.issuedAt ?? new Date(),
          nextAttemptAt: new Date(),
        },
      });
      await this.log(tx, tenantId, id, 'QUEUED', { icv: icv.toString() });
      return updated;
    });
  }

  /** REJECTED/DEAD_LETTER → QUEUED again (manual resubmission; attempts reset). */
  requeueDocument(id: string): Promise<EInvoiceDocument> {
    return this.run(async (tx, tenantId) => {
      const doc = await tx.eInvoiceDocument.findFirst({ where: { id, tenantId } });
      if (!doc) throw new InvalidDocumentStateError('Document not found');
      if (doc.status !== 'REJECTED' && doc.status !== 'DEAD_LETTER') {
        throw new InvalidDocumentStateError(`Cannot requeue a ${doc.status} document`);
      }
      const updated = await tx.eInvoiceDocument.update({
        where: { id },
        data: { status: 'QUEUED', attempts: 0, lastError: null, nextAttemptAt: new Date() },
      });
      await this.log(tx, tenantId, id, 'REQUEUED');
      return updated;
    });
  }

  cancelDocument(id: string): Promise<EInvoiceDocument> {
    return this.run(async (tx, tenantId) => {
      const doc = await tx.eInvoiceDocument.findFirst({ where: { id, tenantId } });
      if (!doc) throw new InvalidDocumentStateError('Document not found');
      if (!['DRAFT', 'REJECTED', 'DEAD_LETTER'].includes(doc.status)) {
        throw new InvalidDocumentStateError(`Cannot cancel a ${doc.status} document`);
      }
      const updated = await tx.eInvoiceDocument.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await this.log(tx, tenantId, id, 'CANCELLED');
      return updated;
    });
  }

  // ------------------------------------------------------------------ worker
  // The worker is not request-scoped: it scans the shared DB cross-tenant (platform
  // context) and each siloed tenant DB individually, claiming due QUEUED docs.

  /** Claim up to `limit` due documents in the shared DB (cross-tenant, FOR UPDATE SKIP LOCKED). */
  claimDueShared(limit: number): Promise<EInvoiceDocument[]> {
    return withPlatform(this.prisma, async (tx) => this.claimDue(tx, limit));
  }

  /** Claim due documents for one siloed tenant, against its own database. */
  claimDueForTenant(tenantId: string, limit: number): Promise<EInvoiceDocument[]> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      this.claimDue(tx, limit),
    );
  }

  private async claimDue(tx: TxClient, limit: number): Promise<EInvoiceDocument[]> {
    const claimed = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "EInvoiceDocument"
      WHERE "status" = 'QUEUED' AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    if (claimed.length === 0) return [];
    const ids = claimed.map((r) => r.id);
    await tx.eInvoiceDocument.updateMany({
      where: { id: { in: ids } },
      data: { status: 'SUBMITTING' },
    });
    return tx.eInvoiceDocument.findMany({ where: { id: { in: ids } } });
  }

  /** Record a submission outcome (worker path — runs in the document's tenant context). */
  recordOutcome(
    tenantId: string,
    documentId: string,
    outcome:
      | {
          kind: 'ACCEPTED';
          qrCode?: string;
          signedDocument?: string;
          providerUuid?: string;
          validationResults?: unknown;
          submittedXml: string;
        }
      | {
          kind: 'REJECTED';
          errorSummary: string;
          validationResults?: unknown;
          submittedXml: string;
        }
      | { kind: 'TRANSIENT'; errorSummary: string },
  ): Promise<void> {
    const client = this.connections.clientFor(tenantId);
    return withTenant(client, tenantId, async (tx) => {
      const doc = await tx.eInvoiceDocument.findFirst({ where: { id: documentId } });
      if (!doc) return;
      if (outcome.kind === 'ACCEPTED') {
        await tx.eInvoiceDocument.update({
          where: { id: documentId },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            lastError: null,
            submittedXml: outcome.submittedXml,
            qrCode: outcome.qrCode ?? null,
            signedInvoice: outcome.signedDocument ?? null,
            providerUuid: outcome.providerUuid ?? null,
            validationResults: (outcome.validationResults ?? undefined) as Prisma.InputJsonValue,
          },
        });
        await this.log(tx, tenantId, documentId, 'ACCEPTED');
        return;
      }
      if (outcome.kind === 'REJECTED') {
        await tx.eInvoiceDocument.update({
          where: { id: documentId },
          data: {
            status: 'REJECTED',
            lastError: outcome.errorSummary,
            submittedXml: outcome.submittedXml,
            validationResults: (outcome.validationResults ?? undefined) as Prisma.InputJsonValue,
          },
        });
        await this.log(tx, tenantId, documentId, 'REJECTED', { error: outcome.errorSummary });
        return;
      }
      // Transient: schedule a retry or dead-letter after the backoff schedule is exhausted.
      const attempts = doc.attempts + 1;
      if (attempts >= RETRY_BACKOFF_MS.length) {
        await tx.eInvoiceDocument.update({
          where: { id: documentId },
          data: { status: 'DEAD_LETTER', attempts, lastError: outcome.errorSummary },
        });
        await this.log(tx, tenantId, documentId, 'DEAD_LETTER', { error: outcome.errorSummary });
      } else {
        await tx.eInvoiceDocument.update({
          where: { id: documentId },
          data: {
            status: 'QUEUED',
            attempts,
            lastError: outcome.errorSummary,
            nextAttemptAt: new Date(Date.now() + RETRY_BACKOFF_MS[attempts]!),
          },
        });
        await this.log(tx, tenantId, documentId, 'RETRY_SCHEDULED', {
          attempt: attempts,
          error: outcome.errorSummary,
        });
      }
    });
  }

  /** Original-invoice lookup for the worker (runs in the document's tenant context). */
  findOriginalForWorker(tenantId: string, id: string): Promise<EInvoiceDocument | null> {
    return withTenant(this.connections.clientFor(tenantId), tenantId, (tx) =>
      tx.eInvoiceDocument.findFirst({ where: { id } }),
    );
  }

  /** Settings + active credential for a tenant, fetched in that tenant's DB (worker path). */
  workerContext(tenantId: string): Promise<{
    settings: EInvoiceSettings | null;
    credential: EInvoiceCredential | null;
  }> {
    const client = this.connections.clientFor(tenantId);
    return withTenant(client, tenantId, async (tx) => ({
      settings: await tx.eInvoiceSettings.findUnique({ where: { tenantId } }),
      credential: await tx.eInvoiceCredential.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
    }));
  }

  // --------------------------------------------------------------- dashboard

  async dashboard(): Promise<{
    today: number;
    thisMonth: number;
    byStatus: Record<string, number>;
    lastAcceptedAt: Date | null;
    lastError: string | null;
  }> {
    return this.run(async (tx, tenantId) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(startOfDay);
      startOfMonth.setDate(1);
      const [today, thisMonth, grouped, lastAccepted, lastFailed] = await Promise.all([
        tx.eInvoiceDocument.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
        tx.eInvoiceDocument.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
        tx.eInvoiceDocument.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
        tx.eInvoiceDocument.findFirst({
          where: { tenantId, status: 'ACCEPTED' },
          orderBy: { acceptedAt: 'desc' },
          select: { acceptedAt: true },
        }),
        tx.eInvoiceDocument.findFirst({
          where: { tenantId, lastError: { not: null } },
          orderBy: { updatedAt: 'desc' },
          select: { lastError: true },
        }),
      ]);
      return {
        today,
        thisMonth,
        byStatus: Object.fromEntries(grouped.map((g) => [g.status, g._count])),
        lastAcceptedAt: lastAccepted?.acceptedAt ?? null,
        lastError: lastFailed?.lastError ?? null,
      };
    });
  }

  // -------------------------------------------------------------------- logs

  private log(
    tx: TxClient,
    tenantId: string,
    documentId: string,
    event: string,
    detail?: Record<string, unknown>,
  ): Promise<unknown> {
    return tx.eInvoiceLog.create({
      data: {
        tenantId,
        documentId,
        event,
        ...(detail !== undefined ? { detail: detail as Prisma.InputJsonValue } : {}),
        actorUserId: TenantContextStore.get()?.actorUserId ?? null,
      },
    });
  }
}
