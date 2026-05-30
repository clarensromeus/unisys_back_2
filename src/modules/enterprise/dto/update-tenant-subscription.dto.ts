import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BillingCycle, SubscriptionStatus } from '@prisma/client';

export class UpdateTenantSubscriptionDto {
  @IsString()
  @MaxLength(120)
  planId: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @IsOptional()
  @IsDateString()
  renewsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsDateString()
  canceledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
