import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardStatus, CardType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class IssueCardDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: 'Physical card / tag UID', example: '04:A2:39:B1:5C:80' })
  @IsString()
  @MaxLength(120)
  cardUid!: string;

  @ApiPropertyOptional({ enum: CardType })
  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;

  @ApiPropertyOptional({ example: 'Blue lanyard' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class UpdateCardDto {
  @ApiPropertyOptional({
    enum: CardStatus,
    description: 'ACTIVE / SUSPENDED / STOLEN / LOST / REVOKED',
  })
  @IsOptional()
  @IsEnum(CardStatus)
  status?: CardStatus;

  @ApiPropertyOptional({ example: 'Replacement card' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
