import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as publicly accessible (skips the global JWT auth guard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
