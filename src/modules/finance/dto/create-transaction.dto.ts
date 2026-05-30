import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';
import { PaymentStatus, TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsUUID()
  studentId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @IsEnum(TransactionType)
  type: TransactionType;
}
