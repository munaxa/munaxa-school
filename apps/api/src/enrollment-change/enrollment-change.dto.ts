import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Administrative Transfer — move the student to a different section (and its classroom) WITHIN the
 * SAME grade. No academic-year or grade change, no financial impact. Operates on the Enrollment only.
 */
export class TransferDto {
  @ApiProperty({ description: 'Target section — must belong to the enrollment’s current grade.' })
  @IsUUID()
  sectionId!: string;

  @ApiPropertyOptional({ description: 'Reason for the transfer (kept on the audit log).' })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Data-entry Grade Correction — the student was admitted into the wrong grade for the CURRENT year.
 * Corrects the Enrollment’s grade (and optional section/classroom). PR 1 does NOT touch the ledger;
 * a grade change surfaces a "review fees in Finance" warning. Operates on the Enrollment only.
 */
export class CorrectGradeDto {
  @ApiProperty({ description: 'Corrected grade for this enrollment.' })
  @IsUUID()
  gradeId!: string;

  @ApiPropertyOptional({
    description: 'Optional section in the corrected grade (sets the classroom).',
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Reason for the correction (kept on the audit log).' })
  @IsOptional()
  @IsString()
  reason?: string;
}
