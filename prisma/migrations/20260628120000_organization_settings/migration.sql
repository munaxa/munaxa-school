-- ============================================================================
-- Organization Settings (Settings → Organization)
--   Single source of truth for school identity, branding, document generation,
--   communication identity, compliance, social presence, and advanced document
--   defaults. One row per tenant; every optional branding/document feature has
--   its own enable toggle. Asset columns store S3 object keys (never binaries).
-- Additive & backward compatible: one new enum + one new tenant-scoped table (RLS).
-- ============================================================================

-- CreateEnum
CREATE TYPE "OrganizationSchoolType" AS ENUM (
  'PRIVATE', 'INTERNATIONAL', 'NATIONAL', 'IB', 'BRITISH', 'AMERICAN', 'OTHER'
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id"       UUID NOT NULL,
    "tenantId" UUID NOT NULL,

    -- General / identity
    "nameEn"           TEXT,
    "nameAr"           TEXT,
    "legalName"        TEXT,
    "shortName"        TEXT,
    "schoolCode"       TEXT,
    "ministryNumber"   TEXT,
    "schoolType"       "OrganizationSchoolType" NOT NULL DEFAULT 'PRIVATE',
    "motto"            TEXT,
    "mission"          TEXT,
    "vision"           TEXT,
    "establishedYear"  INTEGER,
    "description"      TEXT,
    "timezone"         TEXT NOT NULL DEFAULT 'Asia/Amman',
    "defaultLanguage"  TEXT NOT NULL DEFAULT 'en',
    "academicCalendar" TEXT,

    -- Contact
    "phone"            TEXT,
    "mobile"           TEXT,
    "whatsapp"         TEXT,
    "email"            TEXT,
    "website"          TEXT,
    "country"          TEXT,
    "city"             TEXT,
    "district"         TEXT,
    "street"           TEXT,
    "building"         TEXT,
    "postalCode"       TEXT,
    "googleMapsUrl"    TEXT,
    "latitude"         DECIMAL(10,7),
    "longitude"        DECIMAL(10,7),
    "emergencyContact" TEXT,
    "officeHours"      TEXT,

    -- Branding toggles
    "logoEnabled"      BOOLEAN NOT NULL DEFAULT false,
    "darkLogoEnabled"  BOOLEAN NOT NULL DEFAULT false,
    "smallLogoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "watermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stampEnabled"     BOOLEAN NOT NULL DEFAULT false,
    "signatureEnabled" BOOLEAN NOT NULL DEFAULT false,

    -- Branding assets (S3 keys)
    "logoKey"      TEXT,
    "darkLogoKey"  TEXT,
    "smallLogoKey" TEXT,
    "stampKey"     TEXT,
    "signatureKey" TEXT,
    "bannerKey"    TEXT,

    -- Branding structured config
    "logoVisibility"    JSONB,
    "watermark"         JSONB,
    "stampPlacement"    TEXT NOT NULL DEFAULT 'RIGHT',
    "signaturePosition" TEXT NOT NULL DEFAULT 'RIGHT',

    -- Document settings
    "headerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "footerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "qrEnabled"     BOOLEAN NOT NULL DEFAULT false,
    "documents"     JSONB,

    -- Communication identity
    "senderName"              TEXT,
    "senderEmail"             TEXT,
    "replyToEmail"            TEXT,
    "emailFooter"             TEXT,
    "notificationDisplayName" TEXT,
    "smsSender"               TEXT,
    "whatsappDisplayName"     TEXT,
    "pushIconKey"             TEXT,
    "notificationImageKey"    TEXT,

    -- Social & website
    "socialEnabled" BOOLEAN NOT NULL DEFAULT false,
    "social"        JSONB,

    -- Academic identity
    "curriculum"         TEXT,
    "academicYearFormat" TEXT,
    "colorTheme"         TEXT,

    -- Compliance
    "complianceEnabled"      BOOLEAN NOT NULL DEFAULT false,
    "commercialRegistration" TEXT,
    "licenseNumber"          TEXT,
    "ministryLicense"        TEXT,
    "taxNumber"              TEXT,
    "vatNumber"              TEXT,
    "otherGovIds"            JSONB,

    -- Advanced document defaults
    "defaultReportLanguage"      TEXT NOT NULL DEFAULT 'en',
    "defaultCertificateLanguage" TEXT NOT NULL DEFAULT 'en',
    "documentNumberPrefix"       TEXT,
    "defaultFont"                TEXT,
    "defaultReportTheme"         TEXT,
    "defaultLogoVariant"         TEXT NOT NULL DEFAULT 'PRIMARY',
    "documentCompression"        BOOLEAN NOT NULL DEFAULT true,
    "pdfQuality"                 INTEGER NOT NULL DEFAULT 90,
    "imageQuality"               INTEGER NOT NULL DEFAULT 85,
    "storageOptimization"        BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL,
    "deletedAt"   TIMESTAMPTZ(6),

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_tenantId_key" ON "OrganizationSettings"("tenantId");
CREATE INDEX "OrganizationSettings_tenantId_idx" ON "OrganizationSettings"("tenantId");

-- Foreign keys
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Tenant isolation (RLS). FORCE ROW LEVEL SECURITY; policy keys off
-- app_current_tenant()/app_is_platform() exactly like the rest of the schema.
-- ----------------------------------------------------------------------------
ALTER TABLE "OrganizationSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationSettings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrganizationSettings";
CREATE POLICY tenant_isolation ON "OrganizationSettings"
  USING ("tenantId" = app_current_tenant() OR app_is_platform())
  WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform());
