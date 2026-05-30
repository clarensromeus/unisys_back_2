import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { HostelAllocationStatus } from '@prisma/client';

export class CreateHostelAllocationDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  hostelRoomId: string;

  @IsDateString()
  startsOn: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsEnum(HostelAllocationStatus)
  status?: HostelAllocationStatus;
}
