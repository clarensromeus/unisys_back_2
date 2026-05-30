import { SemesterTerm } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSemesterDto {
  @IsUUID()
  academicYearId: string;

  @IsString()
  name: string;

  @IsEnum(SemesterTerm)
  term: SemesterTerm;

  @IsDateString()
  startsOn: string;

  @IsDateString()
  endsOn: string;

  @IsOptional()
  @IsDateString()
  addDropStartsOn?: string;

  @IsOptional()
  @IsDateString()
  addDropEndsOn?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
