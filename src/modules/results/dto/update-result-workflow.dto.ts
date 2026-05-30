import { ResultWorkflowStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateResultWorkflowDto {
  @IsEnum(ResultWorkflowStatus)
  status: ResultWorkflowStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsUUID()
  approvedById?: string;

  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
