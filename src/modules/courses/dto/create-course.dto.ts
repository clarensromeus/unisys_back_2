import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  creditHours?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(12)
  @IsOptional()
  prerequisiteMinimumGrade?: string;
}
