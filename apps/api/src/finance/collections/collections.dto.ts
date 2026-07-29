import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CollectionsStatus,
  CommunicationMedium,
  ReminderChannel,
  ReminderLevel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Record a promise-to-pay: parent commits to pay `amount` by `promiseBy`. */
export class RecordPromiseDto {
  @ApiProperty({ example: '500.000', description: 'Committed amount (JOD)' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ example: '2026-07-15', description: 'Expected payment date (ISO)' })
  @IsDateString()
  promiseBy!: string;

  @ApiPropertyOptional({ description: 'Optional note (context of the arrangement)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/** Resolve a promise-to-pay as kept or broken. */
export class ResolvePromiseDto {
  @ApiProperty({ description: 'true = kept (paid as promised); false = broken' })
  @IsBoolean()
  kept!: boolean;
}

/** Log a parent contact for the Communication Log. */
export class LogCommunicationDto {
  @ApiProperty({ enum: CommunicationMedium, example: 'PHONE' })
  @IsEnum(CommunicationMedium)
  medium!: CommunicationMedium;

  @ApiProperty({ example: 'Called father — will pay 2 installments on Sunday', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note!: string;
}

export class SetCollectionsDto {
  @ApiProperty({
    enum: CollectionsStatus,
    description: 'NONE clears the flag; LEGAL = "contact the lawyer" (excluded from reminders)',
  })
  @IsEnum(CollectionsStatus)
  status!: CollectionsStatus;

  @ApiPropertyOptional({ description: 'Legal/collections note (e.g. lawyer contact, case ref)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SendReminderDto {
  @ApiProperty({ enum: ReminderChannel, isArray: true, example: ['IN_APP', 'SMS'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ReminderChannel, { each: true })
  channels!: ReminderChannel[];

  @ApiPropertyOptional({
    enum: ReminderLevel,
    description:
      'Escalation tone (friendly → suspension notice). Defaults to a neutral reminder. Encourages ' +
      'escalating reminders before any plan change.',
  })
  @IsOptional()
  @IsEnum(ReminderLevel)
  level?: ReminderLevel;
}

/** Manually suspend transport for non-payment (records the reason + who). */
export class SuspendTransportDto {
  @ApiProperty({ example: 'Overdue > 60 days despite reminders', minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

/**
 * Admin-triggered push of outstanding balances to parents, narrowed by filters:
 *   - `minAgeDays`  → only students with overdue balance aged beyond 30 / 60 / 90 days.
 *   - `minAmount`   → only students whose total outstanding is at least this amount (JOD).
 *   - `match`       → combine the two filters with ALL (both must hold, default) or ANY (either).
 * Omitting both filters targets every account with an outstanding balance. LEGAL-tagged students
 * are always excluded.
 */
export class PushOutstandingDto {
  @ApiPropertyOptional({
    enum: [30, 60, 90],
    description: 'Only include balances overdue by more than this many days',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 60, 90])
  minAgeDays?: 30 | 60 | 90;

  @ApiPropertyOptional({
    example: '100.000',
    description: 'Only include accounts whose total outstanding is ≥ this amount (JOD)',
  })
  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'ANY'],
    default: 'ALL',
    description: 'How to combine the age and amount filters when both are provided',
  })
  @IsOptional()
  @IsIn(['ALL', 'ANY'])
  match?: 'ALL' | 'ANY';

  @ApiPropertyOptional({
    default: false,
    description: 'Bypass parents’ notification preferences (school-enforced finance notice)',
  })
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Also email the assigned parent(s) at their email on file (beside the push)',
  })
  @IsOptional()
  @IsBoolean()
  email?: boolean;
}
