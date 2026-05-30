import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus, TransactionType, UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FinanceService } from './finance.service';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('transactions')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.STUDENT)
  findAll(@Query() query: PaginationQueryDto & { studentId?: string; status?: PaymentStatus; type?: TransactionType }, @CurrentUser() user: RequestUser) {
    return this.finance.findAll(query, user);
  }

  @Get('transactions/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.STUDENT)
  findOne(@Param('id') id: string) {
    return this.finance.findOne(id);
  }

  @Post('transactions')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  create(@Body() dto: CreateTransactionDto) {
    return this.finance.create(dto);
  }

  @Patch('transactions/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.finance.update(id, dto);
  }

  @Delete('transactions/:id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.finance.remove(id);
  }

  @Get('expenses')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  expenses(@Query() query: PaginationQueryDto) {
    return this.finance.expenses(query);
  }

  @Get('expenses/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  expense(@Param('id') id: string) {
    return this.finance.expense(id);
  }

  @Post('expenses')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: RequestUser) {
    return this.finance.createExpense(dto, user.id);
  }

  @Patch('expenses/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateExpense(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() user: RequestUser) {
    return this.finance.updateExpense(id, dto, user.id);
  }

  @Delete('expenses/:id')
  @Roles(UserRole.ADMIN)
  removeExpense(@Param('id') id: string) {
    return this.finance.removeExpense(id);
  }
}
