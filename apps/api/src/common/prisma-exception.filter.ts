import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Human-friendly names for columns that carry tenant-unique business identifiers. */
const FIELD_LABELS: Record<string, string> = {
  nationalId: 'national ID',
  moeStudentNumber: 'MoE student number',
  employeeNumber: 'employee number',
  cardUid: 'card UID',
  email: 'email',
  username: 'username',
};

function describeTarget(target: unknown): string {
  const cols: string[] = Array.isArray(target)
    ? target.map((c) => String(c))
    : typeof target === 'string'
      ? target.split('_').filter((c) => c !== 'tenantId' && c !== 'key')
      : [];
  const labelled = cols.map((c) => FIELD_LABELS[c]).filter((c): c is string => Boolean(c));
  return labelled.length > 0 ? labelled.join(', ') : 'value';
}

/**
 * Translates known Prisma errors into clean HTTP responses so clients see an actionable message
 * (e.g. "A record with this national ID already exists.") instead of a generic 500 Internal Error.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'A database error occurred.';

    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation.
        status = HttpStatus.CONFLICT;
        const field = describeTarget(exception.meta?.target);
        message = `A record with this ${field} already exists.`;
        break;
      }
      case 'P2025': {
        // Record required but not found.
        status = HttpStatus.NOT_FOUND;
        message = 'The requested record was not found.';
        break;
      }
      case 'P2003': {
        // Foreign-key constraint failure.
        status = HttpStatus.BAD_REQUEST;
        message = 'A related record is missing or invalid.';
        break;
      }
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
    }

    res.status(status).json({ statusCode: status, message, error: exception.code });
  }
}
