import { LeaveStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsDateString()
  startsOn: string;

  @IsDateString()
  endsOn: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;
}
