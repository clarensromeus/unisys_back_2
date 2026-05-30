import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTranscriptDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isOfficial?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
