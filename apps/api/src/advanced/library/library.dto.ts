import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookDto {
  @ApiProperty({ example: 'Kalila wa Dimna' })
  @IsString()
  @MaxLength(250)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  author?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  copiesTotal?: number;
}

export class CheckoutBookDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bookId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Borrower student (or use borrowerName)' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  borrowerName?: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  dueDate!: string;
}
