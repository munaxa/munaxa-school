-- Add new school-plane staff roles to the RoleKey enum (additive, backward-compatible).
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block alongside other DDL,
-- so each value is added independently and idempotently.
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'Accountant';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'Receptionist';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'Registrar';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'Counselor';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'HR';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'Nurse';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'Librarian';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'StoreKeeper';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'FleetAdmin';
ALTER TYPE "RoleKey" ADD VALUE IF NOT EXISTS 'BusSupervisor';
