import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { User, Prisma } from '@prisma/client';
import { UserStatus } from '@prisma/client';
import { isPlatformRole } from '@school/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { withPlatform, type TxClient } from '../../prisma/tenant.helpers';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { FirebaseService } from './firebase.service';
import { RbacService } from './rbac.service';
import { MailService } from '../../mail/mail.service';
import type { AuthenticatedUser, TokenPair } from '../auth.types';
import type {
  LoginDto,
  SessionExchangeDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ConfirmPasswordResetDto,
} from '../dto/auth.dto';

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface LoginResult {
  tokens: TokenPair;
  mustChangePassword: boolean;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly passwords: PasswordService,
    private readonly firebase: FirebaseService,
    private readonly rbac: RbacService,
    private readonly mail: MailService,
  ) {}

  // Temporary passwords are valid for this long after a Forgot Password request.
  private static readonly RESET_TTL_MS = 24 * 60 * 60 * 1000;
  // Per-email reset throttle (in addition to the per-IP controller throttle): cap reset requests
  // for a single email within a window to blunt targeted mailbox-bombing.
  private static readonly RESET_EMAIL_MAX = 3;
  private static readonly RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000;

  // ----- Local login -------------------------------------------------------
  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    // The transaction returns an outcome rather than throwing, so that failure audit logs
    // are COMMITTED. The HTTP error is raised afterwards, outside the transaction.
    const handle = (dto.identifier ?? dto.email ?? '').trim();
    if (!handle) throw new BadRequestException('An email or username is required');
    const outcome = await withPlatform(this.prisma, async (tx) => {
      const user = await this.resolveUserByIdentifier(tx, handle, dto.tenantSlug);
      if (!user || !user.passwordHash) {
        await this.audit(tx, null, null, 'auth.login.failed', { identifier: handle }, meta);
        return { kind: 'invalid' as const };
      }

      // Per-account lockout (complements the per-IP throttle): too many recent failures since
      // the last successful login locks the account for the remainder of the window — even with
      // the correct password — so online guessing cannot be confirmed.
      if (await this.isLockedOut(tx, user)) {
        await this.audit(tx, user.tenantId, user.id, 'auth.login.locked', {}, meta);
        return {
          kind: 'blocked' as const,
          message: 'Too many failed attempts. Try again in a few minutes.',
        };
      }

      const ok = await this.passwords.verify(dto.password, user.passwordHash);
      if (!ok) {
        await this.audit(tx, user.tenantId, user.id, 'auth.login.failed', {}, meta);
        return { kind: 'invalid' as const };
      }

      // Temporary-password expiry: a correct temporary password used past its 24h window is
      // rejected and the attempt is audited. (Only applies while mustChangePassword is set AND a
      // reset window exists — provisioned accounts with no expiry are unaffected.)
      if (this.isTemporaryPasswordExpired(user)) {
        await this.audit(tx, user.tenantId, user.id, 'auth.password.reset.expired', {}, meta);
        await this.resetAudit(tx, user, 'reset.expired_attempt', meta);
        return {
          kind: 'blocked' as const,
          message: 'Your temporary password has expired. Please request a new one.',
        };
      }

      const blocked = this.loginBlockReason(user);
      if (blocked) {
        await this.audit(tx, user.tenantId, user.id, 'auth.login.blocked', { blocked }, meta);
        return { kind: 'blocked' as const, message: blocked };
      }

      // First successful login on a freshly issued temporary password → audit it before we
      // stamp lastLoginAt (which is what makes the attempt "first").
      if (
        user.mustChangePassword &&
        user.passwordResetIssuedAt &&
        (!user.lastLoginAt || user.lastLoginAt < user.passwordResetIssuedAt)
      ) {
        await this.audit(tx, user.tenantId, user.id, 'auth.password.reset.first_login', {}, meta);
        await this.resetAudit(tx, user, 'reset.first_login', meta);
      }

      // Transparent KDF upgrade: legacy (bcrypt) hashes are re-hashed with scrypt on the
      // first successful login after the migration.
      if (this.passwords.needsRehash(user.passwordHash)) {
        const passwordHash = await this.passwords.hash(dto.password);
        await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      }

      const principal = await this.buildPrincipal(tx, user);
      const tokens = await this.issueTokens(tx, principal, meta);
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.audit(tx, user.tenantId, user.id, 'auth.login.success', {}, meta);
      return {
        kind: 'ok' as const,
        result: { tokens, mustChangePassword: user.mustChangePassword, user: principal },
      };
    });

    if (outcome.kind === 'invalid') throw new UnauthorizedException('Invalid credentials');
    if (outcome.kind === 'blocked') throw new ForbiddenException(outcome.message);
    return outcome.result;
  }

  // ----- Firebase session exchange ----------------------------------------
  async exchangeFirebaseSession(dto: SessionExchangeDto, meta: RequestMeta): Promise<LoginResult> {
    const identity = await this.firebase.verifyIdToken(dto.firebaseIdToken);
    return withPlatform(this.prisma, async (tx) => {
      let user = await tx.user.findFirst({ where: { firebaseUid: identity.uid } });
      if (!user && identity.email) {
        user = await this.resolveUserByEmail(tx, identity.email, dto.tenantSlug);
        if (user) {
          user = await tx.user.update({
            where: { id: user.id },
            data: { firebaseUid: identity.uid },
          });
        }
      }
      if (!user) {
        throw new UnauthorizedException('No Munaxa account is linked to this identity');
      }
      const blocked = this.loginBlockReason(user);
      if (blocked) throw new ForbiddenException(blocked);

      const principal = await this.buildPrincipal(tx, user);
      const tokens = await this.issueTokens(tx, principal, meta);
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await this.audit(tx, user.tenantId, user.id, 'auth.session.exchange', {}, meta);
      return { tokens, mustChangePassword: user.mustChangePassword, user: principal };
    });
  }

  // ----- Refresh (rotation + reuse detection) ------------------------------
  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    // Outcome pattern again: reuse-detection family revocation must COMMIT before we reject.
    const outcome = await withPlatform(this.prisma, async (tx) => {
      const existing = await tx.refreshToken.findUnique({ where: { tokenHash: hash } });
      if (!existing) return { kind: 'invalid' as const };

      // Reuse of an already-rotated/revoked token → compromise: revoke the whole family.
      if (existing.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: existing.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit(tx, existing.tenantId, existing.userId, 'auth.refresh.reuse', {}, meta);
        return { kind: 'reuse' as const };
      }
      if (existing.expiresAt.getTime() < Date.now()) return { kind: 'expired' as const };

      const user = await tx.user.findUniqueOrThrow({ where: { id: existing.userId } });
      const blocked = this.loginBlockReason(user);
      if (blocked) return { kind: 'blocked' as const, message: blocked };
      const principal = await this.buildPrincipal(tx, user);

      // Rotate within the same family.
      const rotated = await this.persistRefreshToken(tx, principal, meta, existing.familyId);
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenId: rotated.row.id },
      });
      const access = this.tokens.signAccessToken(principal);
      return {
        kind: 'ok' as const,
        pair: {
          accessToken: access.token,
          refreshToken: rotated.raw,
          expiresIn: access.expiresIn,
        },
      };
    });

    switch (outcome.kind) {
      case 'invalid':
        throw new UnauthorizedException('Invalid refresh token');
      case 'reuse':
        throw new UnauthorizedException('Refresh token reuse detected');
      case 'expired':
        throw new UnauthorizedException('Refresh token expired');
      case 'blocked':
        throw new ForbiddenException(outcome.message);
      case 'ok':
        return outcome.pair;
    }
  }

  // ----- Logout ------------------------------------------------------------
  async logout(refreshToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    await withPlatform(this.prisma, async (tx) => {
      const token = await tx.refreshToken.findUnique({ where: { tokenHash: hash } });
      if (token && !token.revokedAt) {
        // Revoke the entire family so all derived sessions end.
        await tx.refreshToken.updateMany({
          where: { familyId: token.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
  }

  // ----- Change password (incl. first-login) -------------------------------
  async changePassword(
    userId: string,
    tenantId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<void> {
    if (dto.confirmPassword !== undefined && dto.confirmPassword !== dto.newPassword) {
      throw new BadRequestException('New password and confirmation do not match');
    }
    this.passwords.assertStrong(dto.newPassword);
    await this.passwords.assertNotBreached(dto.newPassword);
    await withPlatform(this.prisma, async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { id: userId, tenantId } });
      if (
        !user.passwordHash ||
        !(await this.passwords.verify(dto.currentPassword, user.passwordHash))
      ) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      // Block reuse: the new password must differ from the current/temporary one.
      if (await this.passwords.verify(dto.newPassword, user.passwordHash)) {
        throw new BadRequestException('New password must be different from the current password');
      }
      const wasReset = user.mustChangePassword;
      const now = new Date();
      const passwordHash = await this.passwords.hash(dto.newPassword);
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordUpdatedAt: now,
          lastPasswordChangeAt: now,
          // Invalidate the temporary-password window so the temp password can never be reused.
          passwordResetIssuedAt: null,
          passwordResetExpiresAt: null,
        },
      });
      // Invalidate all existing sessions on password change.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit(tx, tenantId, user.id, 'auth.password.change', {}, meta);
      if (wasReset) await this.resetAudit(tx, user, 'reset.completed', meta);
    });
  }

  // ----- Forgot Password: temporary-password issuance ----------------------
  /**
   * Forgot Password. Generates a cryptographically secure temporary password, stores ONLY its
   * scrypt hash, marks the account mustChangePassword with a 24h reset window, revokes existing
   * sessions, and emails the temp password from the admin sender. Generating a new temp password
   * overwrites the previous one, so prior temporary passwords are automatically invalidated.
   *
   * Anti-enumeration: this method never throws on unknown email and the controller always replies
   * 202 with a generic message. A per-email throttle (on top of the per-IP controller throttle)
   * blunts targeted mailbox-bombing — silently, so it leaks nothing about account existence.
   */
  async requestPasswordReset(dto: RequestPasswordResetDto, meta: RequestMeta): Promise<void> {
    // Normalised key for the audit trail + rate limit (case-insensitive); DB resolution below
    // uses the raw input to keep exact-match semantics with the rest of the auth flow.
    const emailKey = dto.email.trim().toLowerCase();
    await withPlatform(this.prisma, async (tx) => {
      // Always record the request attempt (even for unknown emails) for abuse analysis.
      await this.resetAuditRaw(tx, null, null, emailKey, 'reset.request', meta);

      // Per-email rate limit — checked from the dedicated audit trail. Silent on trip.
      const since = new Date(Date.now() - AuthService.RESET_EMAIL_WINDOW_MS);
      const recent = await tx.passwordResetAudit.count({
        where: { email: emailKey, action: 'reset.request', createdAt: { gt: since } },
      });
      if (recent > AuthService.RESET_EMAIL_MAX) return;

      const user = await this.resolveUserByEmail(tx, dto.email.trim(), dto.tenantSlug);
      if (!user) return; // do not reveal account existence

      const temporaryPassword = this.passwords.generateTemporary();
      const passwordHash = await this.passwords.hash(temporaryPassword);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + AuthService.RESET_TTL_MS);

      // Overwriting passwordHash invalidates both the old password and any prior temp password.
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordResetIssuedAt: now,
          passwordResetExpiresAt: expiresAt,
        },
      });
      // End every existing session so a stolen/old session can't outlive the reset.
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });

      await this.audit(tx, user.tenantId, user.id, 'auth.password.reset.request', {}, meta);

      const { sent } = await this.mail.sendTemporaryPassword({
        to: user.email,
        userName: this.displayName(user),
        temporaryPassword,
      });
      await this.audit(
        tx,
        user.tenantId,
        user.id,
        'auth.password.reset.email',
        { sent, channel: 'email' },
        meta,
      );
      await this.resetAudit(tx, user, 'reset.email_sent', meta, { sent });
    });
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto, meta: RequestMeta): Promise<void> {
    this.passwords.assertStrong(dto.newPassword);
    await this.passwords.assertNotBreached(dto.newPassword);
    const hash = this.tokens.hashRefreshToken(dto.token);
    await withPlatform(this.prisma, async (tx) => {
      const record = await tx.passwordResetToken.findUnique({ where: { tokenHash: hash } });
      if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('Invalid or expired reset token');
      }
      const passwordHash = await this.passwords.hash(dto.newPassword);
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false, passwordUpdatedAt: new Date() },
      });
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(tx, record.tenantId, record.userId, 'auth.password.reset.confirm', {}, meta);
    });
  }

  // ----- Current principal -------------------------------------------------
  async me(userId: string, tenantId: string): Promise<AuthenticatedUser> {
    return withPlatform(this.prisma, async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { id: userId, tenantId } });
      return this.buildPrincipal(tx, user);
    });
  }

  // ----- Internals ---------------------------------------------------------
  /** Returns a human-readable reason if the account cannot log in, else null. */
  private loginBlockReason(user: User): string | null {
    if (user.deletedAt || user.status === UserStatus.DISABLED) return 'Account is disabled';
    if (user.status === UserStatus.SUSPENDED) return 'Account is suspended';
    return null;
  }

  private static readonly LOCKOUT_MAX_FAILURES = 5;
  private static readonly LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

  /**
   * Locked when the account has accrued too many failed logins within the lockout window,
   * counted since the last successful login (so a success naturally resets the counter).
   * Backed by the committed audit trail — no extra state to maintain.
   */
  private async isLockedOut(tx: TxClient, user: User): Promise<boolean> {
    const windowStart = new Date(Date.now() - AuthService.LOCKOUT_WINDOW_MS);
    const since =
      user.lastLoginAt && user.lastLoginAt > windowStart ? user.lastLoginAt : windowStart;
    const failures = await tx.auditLog.count({
      where: { actorUserId: user.id, action: 'auth.login.failed', createdAt: { gt: since } },
    });
    return failures >= AuthService.LOCKOUT_MAX_FAILURES;
  }

  /** Loose email check: distinguishes an email handle from a username/national-id at login. */
  private looksLikeEmail(handle: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(handle);
  }

  /**
   * Resolve a login handle that may be an email, a username, or a National ID. Email handles use
   * the existing per-tenant email lookup; non-email handles match username OR nationalId within
   * the tenant. Without a tenant slug, the handle must be globally unique (else the caller must
   * disambiguate by school).
   */
  private async resolveUserByIdentifier(
    tx: TxClient,
    handle: string,
    tenantSlug?: string,
  ): Promise<User | null> {
    if (this.looksLikeEmail(handle)) {
      return this.resolveUserByEmail(tx, handle, tenantSlug);
    }
    const username = handle.toLowerCase();
    if (tenantSlug) {
      const tenant = await tx.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) return null;
      return tx.user.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          OR: [{ username }, { nationalId: handle }],
        },
      });
    }
    const matches = await tx.user.findMany({
      where: { deletedAt: null, OR: [{ username }, { nationalId: handle }] },
      take: 2,
    });
    if (matches.length > 1) {
      throw new BadRequestException(
        'This handle is used at more than one school; specify the school.',
      );
    }
    return matches[0] ?? null;
  }

  private async resolveUserByEmail(
    tx: TxClient,
    email: string,
    tenantSlug?: string,
  ): Promise<User | null> {
    if (tenantSlug) {
      const tenant = await tx.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) return null;
      return tx.user.findFirst({ where: { tenantId: tenant.id, email, deletedAt: null } });
    }
    const matches = await tx.user.findMany({ where: { email, deletedAt: null }, take: 2 });
    if (matches.length > 1) {
      throw new BadRequestException('Multiple accounts found for this email; specify the school.');
    }
    return matches[0] ?? null;
  }

  private async buildPrincipal(tx: TxClient, user: User): Promise<AuthenticatedUser> {
    const { roles, permissions } = await this.rbac.loadUserAuthz(tx, user.id);
    const isPlatform = roles.some((r) => isPlatformRole(r));
    return {
      userId: user.id,
      tenantId: user.tenantId,
      isPlatform,
      roles,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async issueTokens(
    tx: TxClient,
    principal: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    const access = this.tokens.signAccessToken(principal);
    const refresh = await this.persistRefreshToken(tx, principal, meta);
    return { accessToken: access.token, refreshToken: refresh.raw, expiresIn: access.expiresIn };
  }

  private async persistRefreshToken(
    tx: TxClient,
    principal: AuthenticatedUser,
    meta: RequestMeta,
    familyId?: string,
  ): Promise<{ raw: string; row: { id: string } }> {
    const { token, hash } = this.tokens.generateRefreshToken();
    const row = await tx.refreshToken.create({
      data: {
        tenantId: principal.tenantId,
        userId: principal.userId,
        tokenHash: hash,
        familyId: familyId ?? crypto.randomUUID(),
        expiresAt: this.tokens.refreshExpiryDate(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      select: { id: true },
    });
    return { raw: token, row };
  }

  /** True when the account is on a temporary password whose 24h window has elapsed. */
  private isTemporaryPasswordExpired(user: User): boolean {
    return Boolean(
      user.mustChangePassword &&
      user.passwordResetExpiresAt &&
      user.passwordResetExpiresAt.getTime() < Date.now(),
    );
  }

  /** Best-effort human name for the temp-password email greeting. */
  private displayName(user: User): string | undefined {
    const en = [user.firstNameEn, user.lastNameEn].filter(Boolean).join(' ').trim();
    if (en) return en;
    const ar = [user.firstNameAr, user.lastNameAr].filter(Boolean).join(' ').trim();
    return ar || user.username || undefined;
  }

  private async audit(
    tx: TxClient,
    tenantId: string | null,
    actorUserId: string | null,
    action: string,
    metadata: Prisma.InputJsonValue,
    meta: RequestMeta,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'Auth',
        metadata,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }

  /** Append to the dedicated password-reset audit trail for a resolved user. */
  private async resetAudit(
    tx: TxClient,
    user: User,
    action: string,
    meta: RequestMeta,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    void extra; // currently captured via the generic AuditLog metadata; kept for signature parity.
    await this.resetAuditRaw(tx, user.tenantId, user.id, user.email, action, meta);
  }

  /** Append to the password-reset audit trail; tenant/user may be null (pre-resolution events). */
  private async resetAuditRaw(
    tx: TxClient,
    tenantId: string | null,
    userId: string | null,
    email: string,
    action: string,
    meta: RequestMeta,
  ): Promise<void> {
    await tx.passwordResetAudit.create({
      data: {
        tenantId,
        userId,
        email,
        action,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }
}
