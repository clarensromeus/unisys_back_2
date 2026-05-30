import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ExamType } from '@prisma/client';

export class CreateExamDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  courseOfferingId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsEnum(ExamType)
  type: ExamType;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passMark: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore: number;
}
