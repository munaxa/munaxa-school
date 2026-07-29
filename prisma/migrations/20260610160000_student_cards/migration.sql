-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('NFC', 'RFID');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'STOLEN', 'LOST', 'REVOKED');

-- CreateTable
CREATE TABLE "StudentCard" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "cardUid" TEXT NOT NULL,
    "type" "CardType" NOT NULL DEFAULT 'NFC',
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "issuedById" UUID,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentCard_tenantId_studentId_idx" ON "StudentCard"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentCard_tenantId_status_idx" ON "StudentCard"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCard_tenantId_cardUid_key" ON "StudentCard"("tenantId", "cardUid");

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCard" ADD CONSTRAINT "StudentCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the student card registry.
-- ============================================================================
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "StudentCard" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "StudentCard" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "StudentCard"';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON "StudentCard"
      USING ("tenantId" = app_current_tenant() OR app_is_platform())
      WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
  $f$;
END $$;
