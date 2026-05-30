import { ContractStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateEmployeeContractDto {
  @IsUUID()
  staffId: string;

  @IsString()
  title: string;

  @IsDateString()
  startsOn: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsNumber()
  @Min(0)
  baseSalary: number;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}
