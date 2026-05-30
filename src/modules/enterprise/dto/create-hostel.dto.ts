import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { HostelGender } from '@prisma/client';

export class CreateHostelDto {
  @IsString()
  @MaxLength(30)
  code: string;

  @IsString()
  @MaxLength(140)
  @Transform(({ value }) => String(value).trim())
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  location?: string;

  @IsOptional()
  @IsEnum(HostelGender)
  gender?: HostelGender;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacityLimit?: number;

  @IsOptional()
  @IsUUID()
  wardenId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
