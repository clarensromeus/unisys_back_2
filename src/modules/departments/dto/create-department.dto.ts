import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @IsOptional()
  @IsUUID()
  headId?: string;
}
