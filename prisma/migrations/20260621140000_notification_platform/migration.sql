-- ============================================================================
-- Notification Platform
--   * Bilingual / typed / prioritized in-app notifications.
--   * Per-user preference matrix, tenant sender settings, versioned templates.
--   * Delivery ledger + append-only notification audit.
--   * Device tokens gain deviceType + active (revocation / invalid-token cleanup).
-- Channels: Push (FCM) + Email (Resend) only. All new tables are tenant-scoped (RLS).
-- Additive & backward compatible: existing Notification rows keep title/body.
-- ============================================================================

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'ARCHIVED');
CREATE TYPE "NotificationCategory" AS ENUM ('ATTENDANCE', 'FINANCE', 'ACADEMIC', 'BEHAVIOR', 'ANNOUNCEMENT', 'SYSTEM');
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'IN_APP');
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'SKIPPED');

-- ----------------------------------------------------------------------------
-- AlterTable: enrich Notification (category was previously a free-text column).
-- ----------------------------------------------------------------------------
ALTER TABLE "Notification"
  ADD COLUMN "type"      TEXT,
  ADD COLUMN "priority"  "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "status"    "NotificationStatus"   NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "titleEn"   TEXT,
  ADD COLUMN "titleAr"   TEXT,
  ADD COLUMN "bodyEn"    TEXT,
  ADD COLUMN "bodyAr"    TEXT,
  ADD COLUMN "mandatory" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "archivedAt" TIMESTAMPTZ(6),
  ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Migrate the legacy free-text category → enum, then swap the column type.
ALTER TABLE "Notification" ADD COLUMN "category_new" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM';
UPDATE "Notification" SET "category_new" =
  CASE upper(coalesce("category", ''))
    WHEN 'ATTENDANCE'   THEN 'ATTENDANCE'::"NotificationCategory"
    WHEN 'FINANCE'      THEN 'FINANCE'::"NotificationCategory"
    WHEN 'ACADEMIC'     THEN 'ACADEMIC'::"NotificationCategory"
    WHEN 'BEHAVIOR'     THEN 'BEHAVIOR'::"NotificationCategory"
    WHEN 'ANNOUNCEMENT' THEN 'ANNOUNCEMENT'::"NotificationCategory"
    ELSE 'SYSTEM'::"NotificationCategory"
  END;
ALTER TABLE "Notification" DROP COLUMN "category";
ALTER TABLE "Notification" RENAME COLUMN "category_new" TO "category";

-- CreateIndex
CREATE INDEX "Notification_tenantId_status_idx" ON "Notification"("tenantId", "status");
CREATE INDEX "Notification_tenantId_category_createdAt_idx" ON "Notification"("tenantId", "category", "createdAt");

-- ----------------------------------------------------------------------------
-- AlterTable: DeviceToken — multi-device revocation + invalid-token cleanup.
-- ----------------------------------------------------------------------------
ALTER TABLE "DeviceToken"
  ADD COLUMN "deviceType" TEXT,
  ADD COLUMN "active"     BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "DeviceToken_tenantId_active_idx" ON "DeviceToken"("tenantId", "active");

-- ----------------------------------------------------------------------------
-- CreateTable: NotificationPreference
-- ----------------------------------------------------------------------------
CREATE TABLE "NotificationPreference" (
    "id"                UUID NOT NULL,
    "tenantId"          UUID NOT NULL,
    "userId"            UUID NOT NULL,
    "pushEnabled"       BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled"      BOOLEAN NOT NULL DEFAULT true,
    "attendancePush"    BOOLEAN NOT NULL DEFAULT true,
    "attendanceEmail"   BOOLEAN NOT NULL DEFAULT true,
    "financePush"       BOOLEAN NOT NULL DEFAULT true,
    "financeEmail"      BOOLEAN NOT NULL DEFAULT true,
    "academicPush"      BOOLEAN NOT NULL DEFAULT true,
    "academicEmail"     BOOLEAN NOT NULL DEFAULT true,
    "behaviorPush"      BOOLEAN NOT NULL DEFAULT true,
    "behaviorEmail"     BOOLEAN NOT NULL DEFAULT true,
    "announcementPush"  BOOLEAN NOT NULL DEFAULT true,
    "announcementEmail" BOOLEAN NOT NULL DEFAULT true,
    "systemPush"        BOOLEAN NOT NULL DEFAULT true,
    "systemEmail"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_key" ON "NotificationPreference"("tenantId", "userId");
CREATE INDEX "NotificationPreference_tenantId_idx" ON "NotificationPreference"("tenantId");

-- ----------------------------------------------------------------------------
-- CreateTable: NotificationTemplate
-- ----------------------------------------------------------------------------
CREATE TABLE "NotificationTemplate" (
    "id"        UUID NOT NULL,
    "tenantId"  UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel"   "NotificationChannel" NOT NULL,
    "language"  TEXT NOT NULL,
    "subject"   TEXT,
    "body"      TEXT NOT NULL,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationTemplate_tenantId_eventType_channel_language_key" ON "NotificationTemplate"("tenantId", "eventType", "channel", "language");
CREATE INDEX "NotificationTemplate_tenantId_idx" ON "NotificationTemplate"("tenantId");

-- ----------------------------------------------------------------------------
-- CreateTable: NotificationDelivery
-- ----------------------------------------------------------------------------
CREATE TABLE "NotificationDelivery" (
    "id"               UUID NOT NULL,
    "tenantId"         UUID NOT NULL,
    "notificationId"   UUID NOT NULL,
    "channel"          "NotificationChannel" NOT NULL,
    "provider"         TEXT NOT NULL,
    "status"           "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerResponse" JSONB,
    "attempts"         INTEGER NOT NULL DEFAULT 0,
    "deliveredAt"      TIMESTAMPTZ(6),
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationDelivery_tenantId_notificationId_idx" ON "NotificationDelivery"("tenantId", "notificationId");
CREATE INDEX "NotificationDelivery_tenantId_status_idx" ON "NotificationDelivery"("tenantId", "status");
CREATE INDEX "NotificationDelivery_tenantId_channel_createdAt_idx" ON "NotificationDelivery"("tenantId", "channel", "createdAt");

-- ----------------------------------------------------------------------------
-- CreateTable: NotificationAudit (append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE "NotificationAudit" (
    "id"             UUID NOT NULL,
    "tenantId"       UUID NOT NULL,
    "notificationId" UUID,
    "action"         TEXT NOT NULL,
    "actorId"        UUID,
    "metadata"       JSONB,
    "createdAt"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationAudit_tenantId_notificationId_idx" ON "NotificationAudit"("tenantId", "notificationId");
CREATE INDEX "NotificationAudit_tenantId_createdAt_idx" ON "NotificationAudit"("tenantId", "createdAt");

-- ----------------------------------------------------------------------------
-- CreateTable: NotificationSettings
-- ----------------------------------------------------------------------------
CREATE TABLE "NotificationSettings" (
    "id"           UUID NOT NULL,
    "tenantId"     UUID NOT NULL,
    "senderName"   TEXT NOT NULL DEFAULT 'Munaxa Notifications',
    "senderEmail"  TEXT NOT NULL DEFAULT 'notification@munaxa.com',
    "replyToEmail" TEXT NOT NULL DEFAULT 'support@munaxa.com',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationSettings_tenantId_key" ON "NotificationSettings"("tenantId");

-- ----------------------------------------------------------------------------
-- Foreign keys
-- ----------------------------------------------------------------------------
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationAudit" ADD CONSTRAINT "NotificationAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationAudit" ADD CONSTRAINT "NotificationAudit_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Tenant isolation (RLS). FORCE ROW LEVEL SECURITY; policies key off
-- app_current_tenant()/app_is_platform() exactly like the rest of the schema.
-- Delivery + audit tables are append-only (SELECT/INSERT only under FORCE RLS).
-- ============================================================================

-- Full-CRUD tenant tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'NotificationPreference', 'NotificationTemplate', 'NotificationSettings'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING ("tenantId" = app_current_tenant() OR app_is_platform())
        WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
    $f$, t);
  END LOOP;
END $$;

-- NotificationDelivery: append-only ledger (SELECT/INSERT/UPDATE for status transitions; no DELETE).
ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_delivery_select ON "NotificationDelivery";
CREATE POLICY notification_delivery_select ON "NotificationDelivery"
  FOR SELECT USING ("tenantId" = app_current_tenant() OR app_is_platform());
DROP POLICY IF EXISTS notification_delivery_insert ON "NotificationDelivery";
CREATE POLICY notification_delivery_insert ON "NotificationDelivery"
  FOR INSERT WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());
DROP POLICY IF EXISTS notification_delivery_update ON "NotificationDelivery";
CREATE POLICY notification_delivery_update ON "NotificationDelivery"
  FOR UPDATE USING ("tenantId" = app_current_tenant() OR app_is_platform())
             WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());

-- NotificationAudit: append-only (SELECT/INSERT only; UPDATE/DELETE denied under FORCE RLS).
ALTER TABLE "NotificationAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationAudit" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_audit_select ON "NotificationAudit";
CREATE POLICY notification_audit_select ON "NotificationAudit"
  FOR SELECT USING ("tenantId" = app_current_tenant() OR app_is_platform());
DROP POLICY IF EXISTS notification_audit_insert ON "NotificationAudit";
CREATE POLICY notification_audit_insert ON "NotificationAudit"
  FOR INSERT WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());
