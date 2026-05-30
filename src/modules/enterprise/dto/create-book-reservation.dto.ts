import { ReservationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateBookReservationDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  bookId: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsDateString()
  expiresAt: string;
}
