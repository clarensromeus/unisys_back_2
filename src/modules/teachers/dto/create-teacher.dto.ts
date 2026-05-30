import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export class CreateTeacherDto {
  @ValidateIf((dto: CreateTeacherDto) => !dto.email)
  @IsUUID()
  userId?: string;

  @ValidateIf((dto: CreateTeacherDto) => !dto.userId)
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  specialization: string;

  @IsOptional()
  @IsString()
  employeeNo?: string;

  @IsOptional()
  @IsString()
  officeLocation?: string;
}
