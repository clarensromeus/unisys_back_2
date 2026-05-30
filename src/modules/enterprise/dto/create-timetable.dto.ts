import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateTimetableDto {
  @IsUUID()
  courseOfferingId: string;

  @IsUUID()
  roomId: string;

  @IsUUID()
  timeSlotId: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;
}
