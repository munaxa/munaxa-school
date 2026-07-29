-- ============================================================================
-- Forgot Password / Temporary Password Reset workflow
--   * User lifecycle columns for the temporary-password reset window.
--   * Dedicated append-only PasswordResetAudit table (tenant-scoped RLS).
-- Additive & backward compatible: all new columns are nullable.
-- ============================================================================

-- AlterTable: temporary-password reset lifecycle on User
ALTER TABLE "User"
  ADD COLUMN "passwordResetIssuedAt"  TIMESTAMPTZ(6),
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMPTZ(6),
  ADD COLUMN "lastPasswordChangeAt"   TIMESTAMPTZ(6);

-- CreateTable: PasswordResetAudit
CREATE TABLE "PasswordResetAudit" (
    "id"        UUID NOT NULL,
    "tenantId"  UUID,
    "userId"    UUID,
    "email"     TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetAudit_tenantId_createdAt_idx" ON "PasswordResetAudit"("tenantId", "createdAt");
CREATE INDEX "PasswordResetAudit_email_createdAt_idx" ON "PasswordResetAudit"("email", "createdAt");
CREATE INDEX "PasswordResetAudit_userId_idx" ON "PasswordResetAudit"("userId");

-- AddForeignKey (SET NULL so audit rows survive tenant/user deletion)
ALTER TABLE "PasswordResetAudit" ADD CONSTRAINT "PasswordResetAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PasswordResetAudit" ADD CONSTRAINT "PasswordResetAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation (RLS) for PasswordResetAudit.
-- Append-only: SELECT/INSERT permitted under tenant (or platform) scope; UPDATE/DELETE
-- denied to everyone (no permissive policy for those commands under FORCE RLS).
--
-- Reset requests are received BEFORE a tenant is resolved (anti-enumeration), so the INSERT
-- policy also permits a NULL tenantId. These pre-resolution rows are only visible to platform
-- sessions, mirroring the AuditLog null-tenant convention.
-- ============================================================================
ALTER TABLE "PasswordResetAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetAudit" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_reset_audit_select ON "PasswordResetAudit";
CREATE POLICY password_reset_audit_select ON "PasswordResetAudit"
  FOR SELECT
  USING (
    "tenantId" = app_current_tenant()
    OR (("tenantId" IS NULL) AND app_is_platform())
    OR app_is_platform()
  );

DROP POLICY IF EXISTS password_reset_audit_insert ON "PasswordResetAudit";
CREATE POLICY password_reset_audit_insert ON "PasswordResetAudit"
  FOR INSERT
  WITH CHECK (
    "tenantId" = app_current_tenant()
    OR "tenantId" IS NULL
    OR app_is_platform()
  );
