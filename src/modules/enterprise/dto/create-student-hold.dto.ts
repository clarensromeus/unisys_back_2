import { HoldStatus, HoldType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStudentHoldDto {
  @IsUUID()
  studentId: string;

  @IsEnum(HoldType)
  type: HoldType;

  @IsEnum(HoldStatus)
  status: HoldStatus;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  releasedAt?: string;
}
