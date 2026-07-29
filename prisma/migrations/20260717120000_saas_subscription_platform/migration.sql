-- ============================================================================
-- Munaxa — SaaS Subscription & Platform Billing (Phase 24)
--
-- Adds the commercial plane: subscription plans (global catalog), per-tenant
-- subscriptions, usage counters, plan-change history, billing profiles, coupons,
-- trials, school upgrade requests, and per-tenant feature overrides.
--
-- RLS: Plan/Feature rows are a global catalog (readable by any bound session,
-- writable only by the platform plane). Coupons are platform-only. Every
-- tenant-scoped table uses the standard tenant_isolation policy so a school reads
-- only its own rows and the platform plane reads/writes across all tenants.
-- ============================================================================

-- Extend the RoleKey enum with the new Platform Console personas.
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'PlatformFinance';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'PlatformSupport';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'PlatformSales';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'PlatformReadOnly';

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'TRIAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "UpgradeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE "CouponDuration" AS ENUM ('ONCE', 'REPEATING', 'FOREVER');
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'OFFLINE', 'STRIPE', 'MYFATOORAH');

-- CreateTable: SubscriptionPlan (global catalog)
CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priceMonthly" INTEGER,
    "priceYearly" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'JOD',
    "maxCampuses" INTEGER,
    "maxStudents" INTEGER,
    "maxStaff" INTEGER,
    "storageGb" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_tier_key" ON "SubscriptionPlan"("tier");
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");

-- CreateTable: SubscriptionFeature (global catalog, per plan)
CREATE TABLE "SubscriptionFeature" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SubscriptionFeature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionFeature_planId_key_key" ON "SubscriptionFeature"("planId", "key");
CREATE INDEX "SubscriptionFeature_planId_idx" ON "SubscriptionFeature"("planId");

-- CreateTable: TenantSubscription (tenant-scoped)
CREATE TABLE "TenantSubscription" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMPTZ(6),
    "trialEndsAt" TIMESTAMPTZ(6),
    "graceEndsAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "couponId" UUID,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantSubscription_status_idx" ON "TenantSubscription"("status");
CREATE INDEX "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");
CREATE INDEX "TenantSubscription_currentPeriodEnd_idx" ON "TenantSubscription"("currentPeriodEnd");

-- CreateTable: SubscriptionUsage (tenant-scoped)
CREATE TABLE "SubscriptionUsage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SubscriptionUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionUsage_tenantId_metric_key" ON "SubscriptionUsage"("tenantId", "metric");
CREATE INDEX "SubscriptionUsage_tenantId_idx" ON "SubscriptionUsage"("tenantId");

-- CreateTable: PlanChangeHistory (tenant-scoped)
CREATE TABLE "PlanChangeHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromPlanId" UUID,
    "toPlanId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromCycle" TEXT,
    "toCycle" TEXT,
    "reason" TEXT,
    "upgradeRequestId" UUID,
    "changedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChangeHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlanChangeHistory_tenantId_createdAt_idx" ON "PlanChangeHistory"("tenantId", "createdAt");

-- CreateTable: BillingProfile (tenant-scoped)
CREATE TABLE "BillingProfile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "country" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "externalCustomerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingProfile_tenantId_key" ON "BillingProfile"("tenantId");

-- CreateTable: Coupon (global catalog)
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "CouponType" NOT NULL,
    "percentOff" INTEGER,
    "amountOff" INTEGER,
    "currency" TEXT,
    "duration" "CouponDuration" NOT NULL DEFAULT 'ONCE',
    "durationMonths" INTEGER,
    "appliesToTier" "PlanTier",
    "maxRedemptions" INTEGER,
    "timesRedeemed" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMPTZ(6),
    "validUntil" TIMESTAMPTZ(6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateTable: Trial (tenant-scoped)
CREATE TABLE "Trial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "convertedAt" TIMESTAMPTZ(6),
    "expiredAt" TIMESTAMPTZ(6),
    "extendedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Trial_tenantId_key" ON "Trial"("tenantId");
CREATE INDEX "Trial_endsAt_idx" ON "Trial"("endsAt");

-- CreateTable: UpgradeRequest (tenant-scoped)
CREATE TABLE "UpgradeRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromPlanId" UUID,
    "requestedPlanId" UUID NOT NULL,
    "requestedCycle" "BillingCycle",
    "status" "UpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedById" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UpgradeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UpgradeRequest_tenantId_status_idx" ON "UpgradeRequest"("tenantId", "status");
CREATE INDEX "UpgradeRequest_status_createdAt_idx" ON "UpgradeRequest"("status", "createdAt");

-- CreateTable: TenantFeatureOverride (tenant-scoped)
CREATE TABLE "TenantFeatureOverride" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN,
    "limitOverride" INTEGER,
    "reason" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantFeatureOverride_tenantId_key_key" ON "TenantFeatureOverride"("tenantId", "key");
CREATE INDEX "TenantFeatureOverride_tenantId_idx" ON "TenantFeatureOverride"("tenantId");

-- AddForeignKey
ALTER TABLE "SubscriptionFeature" ADD CONSTRAINT "SubscriptionFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionUsage" ADD CONSTRAINT "SubscriptionUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanChangeHistory" ADD CONSTRAINT "PlanChangeHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanChangeHistory" ADD CONSTRAINT "PlanChangeHistory_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanChangeHistory" ADD CONSTRAINT "PlanChangeHistory_toPlanId_fkey" FOREIGN KEY ("toPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UpgradeRequest" ADD CONSTRAINT "UpgradeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UpgradeRequest" ADD CONSTRAINT "UpgradeRequest_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UpgradeRequest" ADD CONSTRAINT "UpgradeRequest_requestedPlanId_fkey" FOREIGN KEY ("requestedPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

-- Global catalog: readable by any bound session (a school must see plans to
-- choose an upgrade); writable only by the platform plane.
DO $$
DECLARE
  t text;
  catalog_tables text[] := ARRAY['SubscriptionPlan', 'SubscriptionFeature'];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_read ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_write ON %I', t);
    -- Any bound session (tenant or platform) may read the catalog.
    EXECUTE format($f$
      CREATE POLICY catalog_read ON %I
        FOR SELECT
        USING (app_current_tenant() IS NOT NULL OR app_is_platform())
    $f$, t);
    -- Only platform sessions may insert/update/delete catalog rows.
    EXECUTE format($f$
      CREATE POLICY catalog_write ON %I
        FOR ALL
        USING (app_is_platform())
        WITH CHECK (app_is_platform())
    $f$, t);
  END LOOP;
END $$;

-- Coupons: platform plane only (never exposed to tenants directly).
ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Coupon" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_only ON "Coupon";
CREATE POLICY platform_only ON "Coupon"
  USING (app_is_platform())
  WITH CHECK (app_is_platform());

-- Tenant-scoped commercial tables: a school sees only its own rows; the platform
-- plane reads/writes across all tenants (standard tenant_isolation policy).
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'TenantSubscription', 'SubscriptionUsage', 'PlanChangeHistory',
    'BillingProfile', 'Trial', 'UpgradeRequest', 'TenantFeatureOverride'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
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
