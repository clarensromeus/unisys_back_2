import { PayrollStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreatePayslipDto {
  @IsUUID()
  staffId: string;

  @IsUUID()
  payrollCycleId: string;

  @IsNumber()
  @Min(0)
  grossPay: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsNumber()
  @Min(0)
  netPay: number;

  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;
}
