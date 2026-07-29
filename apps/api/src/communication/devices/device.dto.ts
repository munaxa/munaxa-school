import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'FCM device token' })
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @ApiPropertyOptional({ description: 'Free-form device label, e.g. "Pixel 8" or "iPad"' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceType?: string;
}
