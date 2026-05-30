import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { StudentFileRequestType } from '@prisma/client';

export class CreateFileRequestDto {
  @IsEnum(StudentFileRequestType)
  type: StudentFileRequestType;

  @IsString()
  @MinLength(6)
  reason: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  studentFileId?: string;
}
