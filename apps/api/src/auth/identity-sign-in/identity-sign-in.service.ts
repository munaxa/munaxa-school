import { hkdfSync } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  beginSignIn,
  parseIdentityClients,
  parseIdentityKeys,
  sameValue,
  sealLinkOffer,
  tokenEndpoint,
  unsealLinkOffer,
  verifyIdToken,
  type IdentityClaims,
  type IdentityClient,
  type IdentityKey,
  type LinkOffer,
  type PendingSignIn,
} from './identity-sign-in';

export type IdentityCompletion =
  | { readonly ok: true; readonly claims: IdentityClaims; readonly school: string }
  | { readonly ok: false; readonly reason: string };

/** How long the token endpoint may take before the sign-in fails closed. */
const TOKEN_TIMEOUT_MS = 10_000;

/**
 * The protocol half of signing in with Munaxa Identity: where to send the browser, and turning
 * the code Identity sends back into verified claims. The School half (which user that is) is
 * AuthService.signInWithIdentity. See identity-sign-in.ts.
 */
@Injectable()
export class IdentitySignInService {
  private readonly logger = new Logger(IdentitySignInService.name);
  private readonly issuer: string;
  private readonly redirectUri: string;
  private readonly clients: readonly IdentityClient[];
  private readonly keys: readonly IdentityKey[];
  /** Seals link offers. Derived from JWT_ACCESS_SECRET (required in production) for this use only. */
  private readonly linkKey: Buffer;
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('IDENTITY_SIGN_IN') === 'enabled';
    this.issuer = config.get<string>('IDENTITY_ISSUER') ?? '';
    this.redirectUri = config.get<string>('IDENTITY_SIGN_IN_REDIRECT_URI') ?? '';
    // The environment was validated at boot (config/env.validation.ts); parsing again is cheap.
    this.clients = this.enabled
      ? parseIdentityClients(
          config.get<string>('IDENTITY_SIGN_IN_CLIENTS') ?? '',
          config.get<string>('IDENTITY_SIGN_IN_CLIENT_SECRETS') ?? '',
        ).clients
      : [];
    const secret = config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-only-insecure-access-secret';
    this.linkKey = Buffer.from(
      hkdfSync('sha256', secret, Buffer.alloc(0), 'munaxa-school/identity-link-offer', 32),
    );
    this.keys = this.enabled
      ? parseIdentityKeys(config.get<string>('IDENTITY_PUBLIC_KEYS') ?? '')
      : [];
  }

  /** Whether this school signs in through Identity. */
  offers(school: string): boolean {
    return this.clientFor(school) !== undefined;
  }

  start(school: string): { url: string; pending: PendingSignIn } | null {
    const client = this.clientFor(school);
    if (client === undefined) return null;
    return beginSignIn(this.issuer, this.redirectUri, client);
  }

  async complete(
    pending: PendingSignIn | null,
    query: { readonly code?: unknown; readonly state?: unknown; readonly error?: unknown },
  ): Promise<IdentityCompletion> {
    if (pending === null) return { ok: false, reason: 'NO_BINDING' };
    if (typeof query.state !== 'string' || !sameValue(query.state, pending.state)) {
      return { ok: false, reason: 'STATE' };
    }
    if (query.error !== undefined) return { ok: false, reason: 'PROVIDER_ERROR' };
    if (typeof query.code !== 'string' || query.code === '' || query.code.length > 512) {
      return { ok: false, reason: 'NO_CODE' };
    }
    const client = this.clientFor(pending.school);
    if (client === undefined) return { ok: false, reason: 'NOT_OFFERED' };

    let idToken: unknown;
    try {
      const response = await fetch(tokenEndpoint(this.issuer), {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: query.code,
          redirect_uri: this.redirectUri,
          client_id: client.clientId,
          client_secret: client.secret,
          code_verifier: pending.verifier,
        }).toString(),
        redirect: 'error',
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      });
      if (!response.ok) {
        // The body is Identity's OAuth error object; its code is safe to log, nothing else is.
        const body = (await response.json().catch(() => ({}))) as { error?: unknown };
        const error = typeof body.error === 'string' ? body.error.slice(0, 64) : 'unknown';
        this.logger.warn(`Identity token endpoint refused: ${response.status} ${error}`);
        return { ok: false, reason: 'TOKEN_REFUSED' };
      }
      idToken = ((await response.json()) as { id_token?: unknown }).id_token;
    } catch (error) {
      this.logger.warn(`Identity token endpoint unreachable: ${(error as Error).name}`);
      return { ok: false, reason: 'UNAVAILABLE' };
    }
    if (typeof idToken !== 'string') return { ok: false, reason: 'NO_ID_TOKEN' };

    const checked = verifyIdToken(idToken, {
      issuer: this.issuer,
      client,
      nonce: pending.nonce,
      keys: this.keys,
    });
    if (!checked.ok) {
      this.logger.warn(`Identity id token refused: ${checked.reason}`);
      return { ok: false, reason: checked.reason };
    }
    return { ok: true, claims: checked.claims, school: client.school };
  }

  /** A sealed offer to link this Identity account at the user's next password sign-in. */
  offerLink(claims: IdentityClaims, school: string): string {
    return sealLinkOffer(
      { ...claims, school, expires: Math.floor(Date.now() / 1_000) + 10 * 60 },
      this.linkKey,
    );
  }

  /** The offer, when the cookie is one this service sealed and it has not expired. */
  readLinkOffer(raw: string | undefined): LinkOffer | null {
    if (!this.enabled) return null;
    return unsealLinkOffer(raw, this.linkKey);
  }

  private clientFor(school: string): IdentityClient | undefined {
    if (!this.enabled) return undefined;
    const slug = school.trim().toLowerCase();
    return this.clients.find((client) => client.school === slug);
  }
}
