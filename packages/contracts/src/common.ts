import { z } from 'zod';

/**
 * Cross-cutting API contracts shared between the NestJS API and the Next.js Admin Portal.
 * Business contracts are added per phase.
 */

/** Standard pagination query. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Standard paginated response envelope. */
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** RFC7807-style problem details returned by the API on errors. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  errors?: Array<{ field: string; message: string }>;
  traceId?: string;
}

/** Health-check response. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  info: z.record(z.object({ status: z.string() })).optional(),
  details: z.record(z.unknown()).optional(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
