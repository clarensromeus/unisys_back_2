import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StudentFileRequestStatus } from '@prisma/client';

export class ReviewFileRequestDto {
  @IsEnum(StudentFileRequestStatus)
  status: StudentFileRequestStatus;

  @IsOptional()
  @IsString()
  responseNote?: string;
}
