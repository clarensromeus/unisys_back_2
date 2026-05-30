import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { BillingCycle, OrganizationStatus } from '@prisma/client';

export class CreateSubscriptionPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStudents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStaff?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCampuses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStorageGb?: number;

  @IsOptional()
  features?: Record<string, unknown>;
}
