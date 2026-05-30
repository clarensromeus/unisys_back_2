import { WeekDay } from '@prisma/client';
import { IsEnum, IsString, Matches } from 'class-validator';

export class CreateTimeSlotDto {
  @IsString()
  name: string;

  @IsEnum(WeekDay)
  dayOfWeek: WeekDay;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startsAt: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endsAt: string;
}
