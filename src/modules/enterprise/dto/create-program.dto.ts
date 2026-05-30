import { ProgramLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateProgramDto {
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsEnum(ProgramLevel)
  level: ProgramLevel;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  durationTerms: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(400)
  totalCredits: number;
}
