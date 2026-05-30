import { PartialType } from '@nestjs/swagger';
import { CreatePayrollCycleDto } from './create-payroll-cycle.dto';

export class UpdatePayrollCycleDto extends PartialType(CreatePayrollCycleDto) {}
