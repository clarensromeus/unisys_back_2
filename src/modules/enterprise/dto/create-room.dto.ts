import { RoomType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(RoomType)
  type: RoomType;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  bedCount?: number;

  @IsOptional()
  @IsString()
  building?: string;
}
