-- Add PUSH to the ReminderChannel enum so collections reminder history can record FCM pushes
-- (outstanding-balance push to parents). Additive & backward compatible.
ALTER TYPE "ReminderChannel" ADD VALUE IF NOT EXISTS 'PUSH';
