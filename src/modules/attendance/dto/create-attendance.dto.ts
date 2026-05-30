import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class CreateAttendanceDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  courseOfferingId?: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}
