-- Inline fallback storage for the countersigned registration agreement. When object storage (S3) is
-- not configured, the signed PDF/photo is stored directly on the row (bytea) so the upload + view
-- flow works without cloud credentials (previously the browser PUT to a non-existent stub host,
-- surfacing as "failed to fetch"). When S3 is configured this column stays NULL.
ALTER TABLE "RegistrationAgreement" ADD COLUMN "signedFileData" BYTEA;
