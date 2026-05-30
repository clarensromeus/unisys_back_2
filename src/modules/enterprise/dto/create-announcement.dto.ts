import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AnnouncementAudience, NotificationPriority } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => String(value).trim())
  title: string;

  @IsString()
  @MaxLength(3000)
  @Transform(({ value }) => String(value).trim())
  body: string;

  @IsOptional()
  @IsEnum(AnnouncementAudience)
  audience?: AnnouncementAudience;

  @IsOptional()
  @IsString()
  audienceScopeId?: string;

  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @IsOptional()
  @IsUUID()
  courseOfferingId?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsBoolean()
  requiresAcknowledgment?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
