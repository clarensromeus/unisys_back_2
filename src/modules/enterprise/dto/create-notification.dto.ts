import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NotificationChannel, NotificationPriority, NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsString()
  @MaxLength(140)
  @Transform(({ value }) => String(value).trim())
  title: string;

  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => String(value).trim())
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  link?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
