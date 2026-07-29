-- School-level IANA timezone for the scheduling engine's live time resolution.
-- Defaulted so existing schools get a valid zone; adjust per school in Settings.
ALTER TABLE "School" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Amman';
