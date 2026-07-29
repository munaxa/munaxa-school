import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_CHANGE_KEY = 'allowDuringPasswordChange';

/**
 * Whitelists a route for accounts that are still on a temporary password
 * (mustChangePassword=true). Only the change-password and identity (me) endpoints carry it;
 * every other protected route is blocked by {@link MustChangePasswordGuard} until the user
 * sets a new password. (Login / refresh / logout / forgot-password are @Public and never reach
 * the guard.)
 */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);
