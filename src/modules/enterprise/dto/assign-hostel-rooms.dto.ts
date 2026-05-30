import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { HostelRoomType } from '@prisma/client';

export class AssignHostelRoomsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  roomIds: string[];

  @IsOptional()
  @IsEnum(HostelRoomType)
  roomType?: HostelRoomType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRate?: number;
}
