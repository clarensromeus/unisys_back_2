import { FeeType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateFeeStructureDto {
  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsEnum(FeeType)
  feeType: FeeType;

  @IsString()
  @MaxLength(160)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRecurring?: boolean;
}
