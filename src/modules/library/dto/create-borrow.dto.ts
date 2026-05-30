import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsUUID } from 'class-validator';

export class CreateBorrowDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  bookId: string;

  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @IsOptional()
  @IsBoolean()
  returned?: boolean;
}
