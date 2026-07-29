-- Email is now a reminder channel (collections can email parents beside push).
ALTER TYPE "ReminderChannel" ADD VALUE IF NOT EXISTS 'EMAIL';
