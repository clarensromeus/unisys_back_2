import { UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateStaffDto {
  @IsUUID()
  userId: string;

  @IsString()
  role: string;

  @IsOptional()
  @IsEnum(UserRole)
  accountRole?: UserRole;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary: number;
}
