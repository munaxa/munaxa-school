import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  licenseVerifier,
  verifyLicense,
  type EntitlementSnapshot,
  type LicenseVerifier,
} from '@munaxa/licensing';
import { parseLicensePublicKeys, type Env } from '../config/env.validation';

/** This product's key in every Munaxa licence. */
export const SCHOOL_PRODUCT_KEY = 'school';

export type LicenceState =
  /** `LICENSING_MODE=DATABASE`: the subscription plane decides, as it always has. */
  | { configured: false }
  /**
   * `LICENSING_MODE=LICENSE_FILE`: the licence decides. `snapshot` is `null` when the file is
   * missing or fails verification, and then nothing beyond the core modules is granted.
   */
  | {
      configured: true;
      snapshot: EntitlementSnapshot | null;
      reason: string | null;
      evaluatedAt: Date;
    };

/**
 * The on-premises licence: a signed Munaxa licence file, verified offline with the shared
 * contract (`@munaxa/licensing`). No network, and no key that could sign one — the installation
 * holds public keys only.
 *
 * Re-read at most once per {@link LicenceSource.TTL_MS}, so renewing is copying a new file into
 * place. The latest instant observed is kept for the life of the process and decisions are made at
 * the later of it and the clock, so winding the clock back cannot un-expire a licence while the
 * API runs; across a restart only the licence's own issue time is a floor (see the licensing
 * runbook for that limit).
 */
@Injectable()
export class LicenceSource {
  static readonly TTL_MS = 60_000;
  private readonly logger = new Logger(LicenceSource.name);
  private readonly settings: {
    path: string;
    installationId: string;
    verifier: LicenseVerifier;
  } | null;
  private cached: { state: LicenceState; until: number } | null = null;
  private lastObservedAt: Date | null = null;

  constructor(config: ConfigService<Env, true>) {
    if (config.get('LICENSING_MODE', { infer: true }) !== 'LICENSE_FILE') {
      this.settings = null;
      return;
    }
    // Boot validation has already required and checked these.
    this.settings = {
      path: config.get('LICENSE_FILE_PATH', { infer: true }),
      installationId: config.get('LICENSE_INSTALLATION_ID', { infer: true }),
      verifier: licenseVerifier(
        config.get('LICENSE_ALGORITHM', { infer: true }),
        parseLicensePublicKeys(config.get('LICENSE_PUBLIC_KEYS', { infer: true })),
      ),
    };
  }

  async current(now: Date = new Date()): Promise<LicenceState> {
    if (this.settings === null) return { configured: false };
    if (this.cached && this.cached.until > now.getTime()) return this.cached.state;
    const state = await this.read(this.settings, now);
    this.cached = { state, until: now.getTime() + LicenceSource.TTL_MS };
    return state;
  }

  private async read(
    settings: NonNullable<LicenceSource['settings']>,
    now: Date,
  ): Promise<LicenceState> {
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
    return { configured: true, snapshot: result.snapshot, reason: null, evaluatedAt };
  }

  private refused(reason: string, evaluatedAt: Date): LicenceState {
    this.logger.warn(`The licence could not be confirmed: ${reason}`);
    return { configured: true, snapshot: null, reason, evaluatedAt };
  }
}
