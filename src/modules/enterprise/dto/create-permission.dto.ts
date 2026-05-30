import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  action: string;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
