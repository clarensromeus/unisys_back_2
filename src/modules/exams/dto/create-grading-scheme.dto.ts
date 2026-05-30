import { ExamType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateGradingSchemeDto {
  @IsUUID()
  courseOfferingId: string;

  @IsEnum(ExamType)
  examType: ExamType;

  @IsOptional()
  @IsString()
  title?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumScore?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRequired?: boolean;
}
