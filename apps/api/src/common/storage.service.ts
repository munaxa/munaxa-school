import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LimitKey } from '@school/domain';
import { randomUUID } from 'node:crypto';
import { DomainEvents } from '../events/domain-events';
import type { Capacity } from '../subscription/capacity';
import { SubscriptionService } from '../subscription/subscription.service';
import { BYTES_PER_GB, StorageLedgerRepository } from './storage-ledger.repository';
import { requireTenantId } from './tenant.util';

export interface PresignedUpload {
  uploadUrl: string;
  fileKey: string;
}

/**
 * Allow-list of content types accepted for direct-to-bucket uploads. Deliberately excludes
 * active/executable types (text/html, image/svg+xml, application/x-* binaries, *.js) so a
 * presigned URL can never be used to stage a stored-XSS payload or malware that a later
 * download surfaces inline. New legitimate types must be added here explicitly.
 */
export const ALLOWED_UPLOAD_MIME: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/** Hard ceiling enforced at presign time regardless of the per-feature DTO limit (defense in depth). */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

/** How long a presigned URL stays valid, and so how long its reservation holds room. */
const UPLOAD_URL_SECONDS = 900;
/** A reservation outlives its URL by this much, so an upload that starts at the last second fits. */
const RESERVATION_SLACK_SECONDS = 300;

/**
 * S3 storage for secure direct-to-bucket uploads via pre-signed URLs. The AWS SDK is
 * lazily imported only when configured (AWS_S3_BUCKET present, and credentials the SDK can find:
 * static keys, or the role an ECS task or a web identity provides); otherwise a deterministic
 * dev/test stub URL is returned so the flow is exercisable without cloud credentials. Production
 * never gets a stub: an upload there is refused until storage is configured, because a stub URL
 * stores nothing while the confirm step would record the file as kept.
 *
 * Keys are namespaced by tenant: `tenants/<tenantId>/<prefix>/<uuid>-<safeName>`.
 *
 * It is also where the plan's `storage_gb` limit is enforced, against the bytes the school actually
 * holds (`StorageLedgerRepository`), never a size the client declares:
 *  - issuing an upload URL reserves its declared size — or the per-upload ceiling when none is
 *    declared — and is refused when that would not fit;
 *  - confirming an upload ({@link commitUpload}) reads the object's real size from the bucket and
 *    re-checks; an object that does not fit is deleted and the confirmation refused;
 *  - deleting an object releases its bytes;
 *  - expired reservations are settled with what the bucket holds before each new one, and
 *    {@link reconcileTenant} brings the ledger in line with a listing of the bucket.
 */
@Injectable()
export class StorageService {
  private readonly bucket?: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly production: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly ledger: StorageLedgerRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly events: DomainEvents,
  ) {
    this.bucket = config.get<string>('AWS_S3_BUCKET') || undefined;
    this.region = config.get<string>('AWS_REGION') ?? 'eu-central-1';
    this.endpoint = config.get<string>('AWS_S3_ENDPOINT') || undefined;
    this.production = config.get<string>('NODE_ENV') === 'production';
  }

  get configured(): boolean {
    return Boolean(this.bucket && this.hasCredentials());
  }

  /**
   * Whether the SDK's default chain has credentials to find. On ECS the task role is offered
   * through AWS_CONTAINER_CREDENTIALS_*_URI and there are no keys, which is how the AWS stack runs
   * (no IAM user and no access key exists for School).
   */
  private hasCredentials(): boolean {
    return [
      'AWS_ACCESS_KEY_ID',
      'AWS_CONTAINER_CREDENTIALS_RELATIVE_URI',
      'AWS_CONTAINER_CREDENTIALS_FULL_URI',
      'AWS_WEB_IDENTITY_TOKEN_FILE',
    ].some((key) => Boolean(this.config.get<string>(key)));
  }

  /** Production refuses to stand in for a bucket it does not have. */
  private assertStorageAvailable(): void {
    if (this.production && !this.configured) {
      throw new ServiceUnavailableException('File storage is not available');
    }
  }

  buildKey(tenantId: string, prefix: string, fileName: string): string {
    const safe = fileName
      .replace(/[^A-Za-z0-9._-]/g, '_')
      // Collapse any run of dots so a crafted name (e.g. "../../x") can never embed ".." in the
      // key — keeps the key flat and consistent with assertKeyInTenant's traversal guard.
      .replace(/\.{2,}/g, '_')
      .slice(0, 120);
    return `tenants/${tenantId}/${prefix}/${randomUUID()}-${safe}`;
  }

  /**
   * Guard against cross-tenant object references. The upload flow is two-step: the client gets a
   * presigned PUT for a server-generated key, then echoes a `fileKey` back at "confirm". Because
   * S3 lives outside Postgres, RLS cannot stop a client from confirming/downloading ANOTHER
   * tenant's key. This asserts the key sits inside the caller's tenant namespace
   * (`tenants/<tenantId>/…`). Call it before persisting or signing any client-supplied key.
   */
  assertKeyInTenant(fileKey: string): void {
    const prefix = `tenants/${requireTenantId()}/`;
    if (!fileKey.startsWith(prefix) || fileKey.includes('..')) {
      throw new ForbiddenException('File key does not belong to this tenant');
    }
  }

  /**
   * Validate a client-declared content type / size against the allow-list and hard limits.
   * Called automatically by presignUpload before a URL is minted, so disallowed types are
   * rejected with a 400 (never reaching the bucket). Exposed for reuse + unit testing.
   */
  assertUploadAllowed(contentType: string, sizeBytes?: number): void {
    const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!ALLOWED_UPLOAD_MIME.has(type)) {
      throw new BadRequestException(`Unsupported file type: ${type || '(none)'}`);
    }
    if (sizeBytes !== undefined && (sizeBytes < 0 || sizeBytes > MAX_UPLOAD_BYTES)) {
      throw new BadRequestException(`File exceeds the maximum allowed size`);
    }
  }

  /**
   * Branding-image allow-list for the Organization module. Unlike the generic document
   * allow-list this includes `image/svg+xml` (school logos are commonly vector). These assets
   * are only ever served back via a pre-signed GET from the bucket origin (never inlined from
   * the app origin), and are written with a 5 MB ceiling + SSE — so a crafted SVG cannot become
   * a stored-XSS vector against the application.
   */
  static readonly IMAGE_MIME: ReadonlySet<string> = new Set([
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);
  private static readonly MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  /** Validate a branding image's declared content type / size (images-only, 5 MB cap). */
  assertImageAllowed(contentType: string, sizeBytes?: number): void {
    const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
    if (!StorageService.IMAGE_MIME.has(type)) {
      throw new BadRequestException(`Unsupported image type: ${type || '(none)'}`);
    }
    if (sizeBytes !== undefined && (sizeBytes < 0 || sizeBytes > StorageService.MAX_IMAGE_BYTES)) {
      throw new BadRequestException('Image exceeds the maximum allowed size (5 MB)');
    }
  }

  /** Pre-sign an upload for a branding image (images-only allow-list, incl. SVG). */
  async presignImageUpload(
    fileKey: string,
    contentType: string,
    sizeBytes?: number,
  ): Promise<PresignedUpload> {
    this.assertImageAllowed(contentType, sizeBytes);
    this.assertStorageAvailable();
    await this.reserve(fileKey, sizeBytes ?? StorageService.MAX_IMAGE_BYTES);
    if (!this.configured) {
      const base = this.endpoint ?? 'https://uploads.munaxa.local';
      return { uploadUrl: `${base}/${this.bucket ?? 'munaxa-dev'}/${fileKey}?stub=put`, fileKey };
    }
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: contentType,
      ...(sizeBytes !== undefined ? { ContentLength: sizeBytes } : {}),
      // No ServerSideEncryption here: see presignUpload.
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_SECONDS });
    return { uploadUrl, fileKey };
  }

  async presignUpload(
    fileKey: string,
    contentType: string,
    sizeBytes?: number,
  ): Promise<PresignedUpload> {
    // Reject dangerous/oversized uploads before a presigned URL is ever minted.
    this.assertUploadAllowed(contentType, sizeBytes);
    this.assertStorageAvailable();
    await this.reserve(fileKey, sizeBytes ?? MAX_UPLOAD_BYTES);

    if (!this.configured) {
      const base = this.endpoint ?? 'https://uploads.munaxa.local';
      return { uploadUrl: `${base}/${this.bucket ?? 'munaxa-dev'}/${fileKey}?stub=put`, fileKey };
    }
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      // The signed ContentType is pinned: S3 rejects a PUT whose Content-Type header differs.
      ContentType: contentType,
      // Enforce a max object size at the bucket layer so a stolen/replayed URL can't stream GBs.
      ...(sizeBytes !== undefined ? { ContentLength: sizeBytes } : {}),
      // No ServerSideEncryption: the presigner keeps x-amz-server-side-encryption as a signed
      // header, so every client would have to send it (and the bucket's CORS allow it), and the
      // admin and mobile clients send only Content-Type, so S3 refused the PUT. Objects are
      // encrypted by the bucket's default SSE-S3 (munaxa-platform infra/aws/stack/storage.tf).
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_SECONDS });
    return { uploadUrl, fileKey };
  }

  /**
   * Delete an object from the bucket (best-effort). Used when a signed document is replaced or
   * removed so the bucket never retains an orphaned/superseded copy. No-ops (resolves) when storage
   * is not configured (dev/test) so the calling flow stays exercisable without cloud credentials.
   */
  async deleteObject(fileKey: string): Promise<void> {
    await this.removeFromBucket(fileKey);
    this.reportStored(requireTenantId(), await this.ledger.release(fileKey));
  }

  /**
   * Upload bytes to the bucket from the server (no browser round-trip / CORS). Used by the
   * API-proxied upload path so a countersigned agreement can be stored even when the browser cannot
   * PUT directly to S3. Resolves without doing anything when storage is not configured — the caller
   * then persists the bytes inline instead.
   */
  async putObject(fileKey: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.configured) return;
    // The bytes are in hand, so their size is known exactly: reserve it, write, and record it.
    await this.reserve(fileKey, body.length);
    await this.writeObject(fileKey, body, contentType);
    await this.commitUpload(fileKey);
  }

  private async writeObject(fileKey: string, body: Buffer, contentType: string): Promise<void> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  /** Download an object's bytes from the bucket (server-side). Throws when storage is not configured. */
  async getObject(fileKey: string): Promise<Buffer> {
    if (!this.configured) {
      throw new BadRequestException('Object storage is not configured');
    }
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new BadRequestException('Stored object is empty');
    return Buffer.from(bytes);
  }

  /**
   * Records a direct upload as stored, at the size the bucket reports for it. Call it at the
   * "confirm" step of every upload, after {@link assertKeyInTenant} and before persisting the key.
   * Idempotent: confirming the same key again (a retried request, or one object attached twice)
   * counts it once. Refuses — and deletes the object — when it does not fit the plan; refuses when
   * the object never arrived.
   */
  async commitUpload(fileKey: string): Promise<void> {
    this.assertKeyInTenant(fileKey);
    this.assertStorageAvailable();
    const tenantId = requireTenantId();
    const actual = this.configured
      ? await this.objectSize(fileKey)
      : await this.ledger.reservedSize(fileKey);
    if (actual === null) {
      throw new BadRequestException(
        'The upload has not arrived. Upload the file, then confirm it.',
      );
    }
    let capacity: Capacity;
    try {
      capacity = await this.subscriptions.capacity(tenantId, LimitKey.STORAGE_GB);
    } catch (refusal) {
      // The subscription stopped allowing growth while the file was in flight: it is not kept.
      await this.removeFromBucket(fileKey);
      this.reportStored(tenantId, await this.ledger.release(fileKey));
      throw refusal;
    }
    const outcome = await this.ledger.commit(fileKey, actual, capacity);
    if (outcome.kind === 'gone') {
      throw new BadRequestException('This upload was removed. Upload the file again.');
    }
    this.reportStored(tenantId, outcome.total);
    if (outcome.kind === 'refused') {
      await this.removeFromBucket(fileKey);
      throw (
        capacity.refusal ?? new ForbiddenException('Your plan does not allow storing more files.')
      );
    }
  }

  /**
   * Brings one school's ledger in line with its bucket prefix: objects uploaded but never
   * confirmed, and objects from before the ledger, are counted; objects gone from the bucket are
   * not. Run by `storage:reconcile` (docs/ops/licensing.md). A no-op without a configured bucket.
   */
  async reconcileTenant(tenantId: string): Promise<{ adopted: number; vanished: number } | null> {
    if (!this.configured) return null;
    const listedAt = new Date();
    const listed = await this.listPrefix(`tenants/${tenantId}/`);
    const result = await this.ledger.reconcile(tenantId, listed, listedAt);
    this.reportStored(tenantId, result.total);
    return { adopted: result.adopted, vanished: result.vanished };
  }

  /** Reserves room for an upload URL about to be issued, after settling expired reservations. */
  private async reserve(fileKey: string, bytes: number): Promise<void> {
    const tenantId = requireTenantId();
    await this.settleExpired();
    const capacity = await this.subscriptions.capacity(tenantId, LimitKey.STORAGE_GB);
    const expiresAt = new Date(
      Date.now() + (UPLOAD_URL_SECONDS + RESERVATION_SLACK_SECONDS) * 1000,
    );
    await this.ledger.reserve(fileKey, BigInt(bytes), expiresAt, capacity);
  }

  /**
   * An expired reservation is settled with what the bucket holds: the object counts if it arrived
   * — confirmed or not — and is released if it did not. Done before every reservation, so an upload
   * that is never confirmed cannot hold room it does not use, nor occupy the bucket uncounted.
   */
  private async settleExpired(): Promise<void> {
    for (const row of await this.ledger.expiredReservations()) {
      const size = this.configured ? await this.objectSize(row.key) : null;
      await this.ledger.settle(row.key, size);
    }
  }

  private reportStored(tenantId: string, totalBytes: bigint): void {
    // Whole GB, rounded up: the usage table holds integers, and a school holding any bytes at all
    // must not read as holding none. The limit itself is enforced on exact bytes (the ledger).
    const gigabytes = Number((totalBytes + BYTES_PER_GB - 1n) / BYTES_PER_GB);
    this.events.emit({ type: 'StorageChanged', tenantId, gigabytes });
  }

  private async removeFromBucket(fileKey: string): Promise<void> {
    if (!this.configured) return;
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey }));
  }

  /** The object's size as the bucket reports it, or `null` when there is no such object. */
  private async objectSize(fileKey: string): Promise<bigint | null> {
    const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: fileKey }));
      return BigInt(head.ContentLength ?? 0);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  private async listPrefix(prefix: string): Promise<Map<string, bigint>> {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    const listed = new Map<string, bigint>();
    let token: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) listed.set(object.Key, BigInt(object.Size ?? 0));
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return listed;
  }

  /**
   * Pre-sign a download. `attachment` makes the bucket answer with `Content-Disposition:
   * attachment`, so opening the URL downloads the file instead of rendering it on the bucket
   * origin; `<img>` still displays it. Branding images use it because they may be SVG, which a
   * browser would otherwise run as a document.
   */
  async presignDownload(fileKey: string, options: { attachment?: boolean } = {}): Promise<string> {
    // Not refused in production: listings sign every key they hold, and with uploads refused an
    // unconfigured production holds none to sign.
    if (!this.configured) {
      const base = this.endpoint ?? 'https://uploads.munaxa.local';
      return `${base}/${this.bucket ?? 'munaxa-dev'}/${fileKey}?stub=get`;
    }
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = new S3Client({ region: this.region, endpoint: this.endpoint });
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ...(options.attachment ? { ResponseContentDisposition: 'attachment' } : {}),
    });
    return getSignedUrl(client, command, { expiresIn: 900 });
  }
}
