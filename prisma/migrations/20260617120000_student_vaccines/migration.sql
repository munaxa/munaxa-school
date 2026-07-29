-- CreateTable
CREATE TABLE "StudentVaccine" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "received" BOOLEAN NOT NULL DEFAULT true,
    "dateGiven" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StudentVaccine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentVaccine_tenantId_studentId_idx" ON "StudentVaccine"("tenantId", "studentId");

-- AddForeignKey
ALTER TABLE "StudentVaccine" ADD CONSTRAINT "StudentVaccine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentVaccine" ADD CONSTRAINT "StudentVaccine_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- ============================================================================
-- Tenant isolation (RLS) for the student vaccination registry.
-- ============================================================================
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "StudentVaccine" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "StudentVaccine" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON "StudentVaccine"';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON "StudentVaccine"
      USING ("tenantId" = app_current_tenant() OR app_is_platform())
      WITH CHECK ("tenantId" = app_current_tenant() OR app_is_platform())
  $f$;
END $$;
