import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RegistrationStatus } from '@prisma/client';

export class CreateRegistrationDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  courseOfferingId: string;

  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;
}
