import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ example: 'Munaxa Notifications' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  senderName?: string;

  @ApiPropertyOptional({ example: 'notification@munaxa.com' })
  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  @ApiPropertyOptional({ example: 'support@munaxa.com' })
  @IsOptional()
  @IsEmail()
  replyToEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}
