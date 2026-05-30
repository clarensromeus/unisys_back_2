import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateExamScheduleDto {
  @IsUUID()
  examId: string;

  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsUUID()
  invigilatorId?: string;

  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
