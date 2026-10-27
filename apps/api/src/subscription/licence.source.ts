import { readFile } from 'node:fs/promises';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessMode,
  SAAS_AVAILABILITY_POLICY,
  entitlementsPath,
  licenseVerifier,
  readEntitlementResponse,
  resolveSnapshot,
  unreachable,
  usagePath,
  verifyLicense,
  type EntitlementAnswer,
  type EntitlementSnapshot,
  type LicenseVerifier,
  type UsageBatch,
} from '@munaxa/licensing';
import { parseLicensePublicKeys, type Env } from '../config/env.validation';
import { LicensingStateStore, type LicensingStateWrite } from './licensing-state.store';

/** This product's key in every Munaxa licence. */
export const SCHOOL_PRODUCT_KEY = 'school';

/** The `fetch` the control-plane client sends with. Bound only by tests. */
export const LICENSING_FETCH = Symbol('LICENSING_FETCH');

export type LicenceState =
  /** `LICENSING_MODE=DATABASE`: the subscription plane decides, as it always has. */
  | { configured: false }
  /**
   * `LICENSE_FILE` or `CONTROL_PLANE`: the Munaxa licensing contract decides. `snapshot` is `null`
   * when nothing trustworthy is known, and then nothing beyond the core modules is granted.
   */
  | {
      configured: true;
      snapshot: EntitlementSnapshot | null;
      /** The ceiling an outage imposes on top of the snapshot. `FULL` when the answer is fresh. */
      cap: AccessMode;
      reason: string | null;
      evaluatedAt: Date;
    };

type Configured = Extract<LicenceState, { configured: true }>;

const CONTROL_PLANE_TIMEOUT_MS = 3_000;

/**
 * Where this installation's entitlements come from, when not from its own database.
 *
 * - **`LICENSE_FILE`** (a school's own server): a signed Munaxa licence, verified offline with the
 *   shared contract (`@munaxa/licensing`). No network, and no key that could sign one — the
 *   installation holds public keys only. Re-read at most once per {@link LicenceSource.TTL_MS}, so
 *   renewing is copying a new file into place.
 * - **`CONTROL_PLANE`** (Munaxa-hosted): the central subscription service, asked per tenant with
 *   this deployment's service credential and reused for {@link LicenceSource.TTL_MS}. When it
 *   cannot be asked, the last snapshot it gave is used, degraded by age through the shared outage
 *   policy (full for an hour, no growth for a day, read-only for a week, then nothing). A `404` is
 *   an answer — no subscription — and drops that snapshot, so it cannot bridge a later outage into
 *   access the service has already withdrawn.
 *
 * What was verified is kept in `LicensingState`, per school: the last snapshot the service gave
 * and the latest instant observed. So a process started during an outage bridges it with the last
 * answer, degraded by its age, as a running one would; and decisions are made at the later of the
 * clock and the latest instant any process observed for the school, so a clock wound back cannot
 * un-expire a term, across restarts too (see the licensing runbook).
 */
@Injectable()
export class LicenceSource {
  static readonly TTL_MS = 60_000;
  private readonly logger = new Logger(LicenceSource.name);
  private readonly file: {
    path: string;
    installationId: string;
    verifier: LicenseVerifier;
  } | null = null;
  private readonly controlPlane: { url: string; token: string } | null = null;
  private readonly fetch: typeof fetch;
  private fileCache: { state: Configured; until: number } | null = null;
  private readonly tenantCache = new Map<string, { state: Configured; until: number }>();
  private readonly lastGood = new Map<string, EntitlementSnapshot>();
  private lastObservedAt: Date | null = null;
  private readonly loaded = new Set<string>();

  constructor(
    config: ConfigService<Env, true>,
    private readonly store: LicensingStateStore,
    @Optional() @Inject(LICENSING_FETCH) fetchImpl?: typeof fetch,
  ) {
    this.fetch = fetchImpl ?? globalThis.fetch;
    const mode = config.get('LICENSING_MODE', { infer: true });
    // Boot validation has already required and checked what each mode needs.
    if (mode === 'LICENSE_FILE') {
      this.file = {
        path: config.get('LICENSE_FILE_PATH', { infer: true }),
        installationId: config.get('LICENSE_INSTALLATION_ID', { infer: true }),
        verifier: licenseVerifier(
          config.get('LICENSE_ALGORITHM', { infer: true }),
          parseLicensePublicKeys(config.get('LICENSE_PUBLIC_KEYS', { infer: true })),
        ),
      };
    } else if (mode === 'CONTROL_PLANE') {
      this.controlPlane = {
        url: (config.get('CONTROL_PLANE_URL', { infer: true }) ?? '').replace(/\/+$/, ''),
        token: config.get('CONTROL_PLANE_TOKEN', { infer: true }) ?? '',
      };
    }
  }

  /** What is known about this tenant's entitlements right now. */
  async current(tenantId: string, now: Date = new Date()): Promise<LicenceState> {
    if (this.file !== null) {
      if (this.fileCache && this.fileCache.until > now.getTime()) return this.fileCache.state;
      await this.recall(tenantId);
      const state = await this.readFile(this.file, tenantId, now);
      this.fileCache = { state, until: now.getTime() + LicenceSource.TTL_MS };
      return state;
    }
    if (this.controlPlane !== null) {
      const hit = this.tenantCache.get(tenantId);
      if (hit && hit.until > now.getTime()) return hit.state;
      const state = await this.ask(this.controlPlane, tenantId, now);
      this.tenantCache.set(tenantId, { state, until: now.getTime() + LicenceSource.TTL_MS });
      return state;
    }
    return { configured: false };
  }

  /**
   * Report a metered level to the central service. Hosted deployments only, and best effort:
   * usage is informational there, School enforces its own limits against its own rows, and a lost
   * report never changes access. Idempotent on (tenant, metric, instant), so a retry is harmless.
   */
  async reportUsage(
    tenantId: string,
    metric: string,
    value: number,
    at = new Date(),
  ): Promise<void> {
    if (this.controlPlane === null) return;
    const batch: UsageBatch = {
      reports: [
        { tenantId, metric, value: Math.max(0, Math.trunc(value)), measuredAt: at.toISOString() },
      ],
    };
    try {
      const response = await this.fetch(
        `${this.controlPlane.url}${usagePath(SCHOOL_PRODUCT_KEY)}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${this.controlPlane.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(CONTROL_PLANE_TIMEOUT_MS),
          redirect: 'error',
        },
      );
      if (!response.ok) this.logger.warn(`Usage report refused: HTTP ${response.status}`);
    } catch (error) {
      this.logger.warn(`Usage report not delivered: ${(error as Error).name}`);
    }
  }

  /**
   * Folds what an earlier process verified for this school into this one, once: its latest
   * observed instant, and the snapshot that bridges an outage. A store that cannot be read leaves
   * the process with what it alone has seen — never with more.
   */
  private async recall(tenantId: string): Promise<void> {
    if (this.loaded.has(tenantId)) return;
    let stored;
    try {
      stored = await this.store.read(tenantId);
    } catch (error) {
      this.logger.warn(
        `Licensing state for ${tenantId} could not be read: ${(error as Error).name}`,
      );
      return;
    }
    this.loaded.add(tenantId);
    if (!stored) return;
    if (!this.lastObservedAt || stored.lastObservedAt > this.lastObservedAt) {
      this.lastObservedAt = stored.lastObservedAt;
    }
    if (stored.snapshot && !this.lastGood.has(tenantId)) {
      this.lastGood.set(tenantId, stored.snapshot);
    }
  }

  private async remember(tenantId: string, state: LicensingStateWrite): Promise<void> {
    try {
      await this.store.write(tenantId, state);
    } catch (error) {
      this.logger.warn(
        `Licensing state for ${tenantId} could not be kept: ${(error as Error).name}`,
      );
    }
  }

  private observe(now: Date): Date {
    const evaluatedAt =
      this.lastObservedAt && this.lastObservedAt > now ? this.lastObservedAt : now;
    this.lastObservedAt = evaluatedAt;
    return evaluatedAt;
  }

  private async ask(
    settings: { url: string; token: string },
    tenantId: string,
    now: Date,
  ): Promise<Configured> {
    await this.recall(tenantId);
    const evaluatedAt = this.observe(now);
    const answer = await this.fetchEntitlements(settings, tenantId);
    if (answer.kind === 'SNAPSHOT') {
      this.lastGood.set(tenantId, answer.snapshot);
      await this.remember(tenantId, {
        snapshot: answer.snapshot,
        source: 'CONTROL_PLANE',
        observedAt: evaluatedAt,
      });
      return {
        configured: true,
        snapshot: answer.snapshot,
        cap: AccessMode.FULL,
        reason: null,
        evaluatedAt,
      };
    }
    this.logger.warn(`Entitlements for ${tenantId} could not be confirmed: ${answer.reason}`);
    if (answer.kind === 'NONE') {
      this.lastGood.delete(tenantId);
      await this.remember(tenantId, {
        snapshot: null,
        source: 'CONTROL_PLANE',
        observedAt: evaluatedAt,
      });
      return {
        configured: true,
        snapshot: null,
        cap: AccessMode.NONE,
        reason: answer.reason,
        evaluatedAt,
      };
    }
    const resolved = resolveSnapshot(
      null,
      this.lastGood.get(tenantId) ?? null,
      evaluatedAt,
      SAAS_AVAILABILITY_POLICY,
    );
    return {
      configured: true,
      snapshot: resolved.snapshot,
      cap: resolved.cap,
      reason: answer.reason,
      evaluatedAt,
    };
  }

  /** Never throws: an outage is an answer, and a thrown error tends to be caught permissively. */
  private async fetchEntitlements(
    settings: { url: string; token: string },
    tenantId: string,
  ): Promise<EntitlementAnswer> {
    try {
      const response = await this.fetch(
        `${settings.url}${entitlementsPath(SCHOOL_PRODUCT_KEY, tenantId)}`,
        {
          headers: { authorization: `Bearer ${settings.token}`, accept: 'application/json' },
          signal: AbortSignal.timeout(CONTROL_PLANE_TIMEOUT_MS),
          // A redirect would carry the credential somewhere this deployment was not told about.
          redirect: 'error',
        },
      );
      return readEntitlementResponse(
        { status: response.status, body: await response.text() },
        { product: SCHOOL_PRODUCT_KEY, tenantId },
      );
    } catch (error) {
      return unreachable((error as Error).name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK');
    }
  }

  private async readFile(
    settings: NonNullable<LicenceSource['file']>,
    tenantId: string,
    now: Date,
  ): Promise<Configured> {
    const evaluatedAt =
      this.lastObservedAt && this.lastObservedAt > now ? this.lastObservedAt : now;
    let text: string;
    try {
      text = await readFile(settings.path, 'utf8');
    } catch {
      return this.refused('LICENSE_FILE_UNREADABLE', evaluatedAt);
    }
    const result = verifyLicense(text, {
      verifier: settings.verifier,
      product: SCHOOL_PRODUCT_KEY,
      installationId: settings.installationId,
      now,
      lastObservedAt: this.lastObservedAt,
    });
    if (!result.ok) return this.refused(`LICENSE_${result.reason}`, evaluatedAt);
    this.lastObservedAt = evaluatedAt;
    // Only the licence's own school is remembered: another tenant asking learns nothing it may keep.
    if (result.snapshot.tenantId === tenantId) {
      await this.remember(tenantId, {
        snapshot: result.snapshot,
        source: 'LICENSE_FILE',
        observedAt: evaluatedAt,
      });
    }
    return {
      configured: true,
      snapshot: result.snapshot,
      cap: AccessMode.FULL,
      reason: null,
      evaluatedAt,
    };
  }

  private refused(reason: string, evaluatedAt: Date): Configured {
    this.logger.warn(`The licence could not be confirmed: ${reason}`);
    return { configured: true, snapshot: null, cap: AccessMode.NONE, reason, evaluatedAt };
  }
}
