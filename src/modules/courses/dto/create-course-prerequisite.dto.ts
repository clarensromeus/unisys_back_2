import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCoursePrerequisiteDto {
  @IsUUID()
  prerequisiteCourseId: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  minimumGrade?: string;
}
