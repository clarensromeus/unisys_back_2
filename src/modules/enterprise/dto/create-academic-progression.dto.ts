import { AcademicStanding } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateAcademicProgressionDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  semesterId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  attemptedCredits: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  earnedCredits: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4)
  termGpa: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4)
  cumulativeGpa: number;

  @IsEnum(AcademicStanding)
  standing: AcademicStanding;

  @IsOptional()
  @IsString()
  notes?: string;
}
