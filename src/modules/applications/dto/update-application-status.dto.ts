import { AdmissionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsEnum(AdmissionStatus)
  status!: AdmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNotes?: string;
}
