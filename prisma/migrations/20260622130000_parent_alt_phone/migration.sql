-- Second (alternate) mobile number for a parent/guardian. The primary phone is
-- the mandatory one (enforced at the API/UI layer); this one is optional.
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "phoneAlt" TEXT;
