import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  action: string;

  @IsString()
  entity: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  before?: unknown;

  @IsOptional()
  after?: unknown;

  @IsOptional()
  metadata?: unknown;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}
