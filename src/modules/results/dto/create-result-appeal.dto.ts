import { AppealStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateResultAppealDto {
  @IsUUID()
  resultId: string;

  @IsUUID()
  studentId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  newScore?: number;

  @IsOptional()
  @IsString()
  responseNote?: string;
}
