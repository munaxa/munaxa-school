-- One parent record per (tenant, mobile): de-duplicate guardians by mobile number.
-- Registration reuses an existing parent by mobile instead of creating a duplicate.
-- NULL phones are allowed and treated as distinct by Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS "Parent_tenantId_phone_key" ON "Parent"("tenantId", "phone");
