import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ResultWorkflowStatus } from '@prisma/client';

export class CreateResultDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  examId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsString()
  grade: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(4)
  gradePoints?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPassed?: boolean;

  @IsOptional()
  @IsEnum(ResultWorkflowStatus)
  status?: ResultWorkflowStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}
