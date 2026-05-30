import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsString, IsUUID } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class CreateStudentDto {
  @IsUUID()
  userId: string;

  @IsString()
  studentId: string;

  @IsUUID()
  departmentId: string;

  @Type(() => Date)
  @IsDate()
  enrollmentDate: Date;

  @IsEnum(StudentStatus)
  status: StudentStatus = StudentStatus.ACTIVE;
}
