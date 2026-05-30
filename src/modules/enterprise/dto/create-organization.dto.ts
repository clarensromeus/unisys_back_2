import { OrganizationStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  customDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  adminFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  adminLastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  adminPassword?: string;
}
