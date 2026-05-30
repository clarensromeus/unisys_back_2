import { PayrollStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreatePayrollCycleDto {
  @IsString()
  name: string;

  @IsDateString()
  startsOn: string;

  @IsDateString()
  endsOn: string;

  @IsDateString()
  payDate: string;

  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;
}
