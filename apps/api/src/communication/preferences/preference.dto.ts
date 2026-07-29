import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Partial update to the per-user notification preference matrix. All fields optional. */
export class UpdatePreferenceDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() pushEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailEnabled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() attendancePush?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() attendanceEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() financePush?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() financeEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() academicPush?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() academicEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() behaviorPush?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() behaviorEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() announcementPush?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() announcementEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() systemPush?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() systemEmail?: boolean;
}
