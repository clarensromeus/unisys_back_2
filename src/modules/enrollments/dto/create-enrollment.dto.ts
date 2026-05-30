import { IsString, IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  courseId: string;

  @IsString()
  semester: string;
}
