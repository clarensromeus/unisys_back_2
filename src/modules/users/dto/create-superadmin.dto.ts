import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSuperAdminDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value).trim())
  firstName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value).trim())
  lastName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value).trim())
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
