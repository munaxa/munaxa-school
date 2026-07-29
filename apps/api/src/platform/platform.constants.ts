/**
 * The reserved "home" tenant that owns Platform Console (Munaxa employee) user accounts.
 *
 * Platform users are still {@link User} rows, and `User.tenantId` is non-null, so platform
 * employees need a tenant to belong to. This one is reserved: it is NEVER a customer school and
 * is excluded from every customer-facing listing in the Platform Console. Platform authorization
 * itself comes from the user holding a global Platform role (`isPlatform`), not from this tenant.
 */
export const PLATFORM_TENANT_ID = '00000000-0000-4000-8000-000000000001';
export const PLATFORM_TENANT_SLUG = 'munaxa-platform';
