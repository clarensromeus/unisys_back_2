import { BadRequestException, Injectable } from '@nestjs/common';
import { ExpenseCategory, ExpenseStatus, PaymentMethod, PaymentStatus, Prisma, TransactionType, UserRole } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto & { studentId?: string; status?: PaymentStatus; type?: TransactionType }, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const student = user?.role === UserRole.STUDENT
      ? await this.prisma.student.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } })
      : null;
    const where: Prisma.TransactionWhereInput = {
      organizationId,
      studentId: student?.id || query.studentId,
      status: query.status,
      type: query.type,
    };
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({ where, skip, take, include: { student: { include: { user: { select: { email: true } } } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.transaction.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.transaction.findFirstOrThrow({ where: { id, organizationId }, include: { student: true } });
  }

  async create(dto: CreateTransactionDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } });
    if (!student) throw new BadRequestException('Selected student does not exist');
    return this.prisma.transaction.create({ data: { ...dto, organizationId }, include: { student: true } });
  }

  async update(id: string, dto: UpdateTransactionDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.transaction.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } });
      if (!student) throw new BadRequestException('Selected student does not exist');
    }
    return this.prisma.transaction.update({ where: { id }, data: dto, include: { student: true } });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.transaction.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.transaction.delete({ where: { id } });
  }

  async expenses(query: PaginationQueryDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.ExpenseWhereInput = {
      organizationId,
      deletedAt: null,
      category: (query.categoryName || query.type) as ExpenseCategory | undefined,
      status: query.status as ExpenseStatus | undefined,
      paymentMethod: query.method as PaymentMethod | undefined,
      OR: query.search
        ? [
            { expenseNo: { contains: query.search, mode: 'insensitive' } },
            { title: { contains: query.search, mode: 'insensitive' } },
            { vendor: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take,
        include: {
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { expenseDate: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async expense(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.expense.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async createExpense(dto: CreateExpenseDto, userId: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const year = new Date().getFullYear();
    const total = await this.prisma.expense.count({ where: { organizationId, expenseNo: { startsWith: `EXP-${year}-` } } });
    const expenseNo = `EXP-${year}-${String(total + 1).padStart(5, '0')}`;
    return this.prisma.expense.create({
      data: {
        organizationId,
        expenseNo,
        title: dto.title.trim(),
        description: dto.description?.trim() || undefined,
        category: dto.category,
        amount: dto.amount,
        status: dto.status ?? ExpenseStatus.SUBMITTED,
        vendor: dto.vendor?.trim() || undefined,
        paymentMethod: dto.paymentMethod,
        expenseDate: dto.expenseDate ?? new Date(),
        paidAt: dto.paidAt,
        createdById: userId,
        approvedById: dto.status === ExpenseStatus.APPROVED || dto.status === ExpenseStatus.PAID ? userId : undefined,
      },
      include: { createdBy: { select: { email: true, firstName: true, lastName: true } }, approvedBy: { select: { email: true, firstName: true, lastName: true } } },
    });
  }

  async updateExpense(id: string, dto: UpdateExpenseDto, userId: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.expense.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.expense.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: dto.category,
        amount: dto.amount,
        status: dto.status,
        vendor: dto.vendor?.trim(),
        paymentMethod: dto.paymentMethod,
        expenseDate: dto.expenseDate,
        paidAt: dto.paidAt,
        approvedById: dto.status === ExpenseStatus.APPROVED || dto.status === ExpenseStatus.PAID ? userId : undefined,
      },
      include: { createdBy: { select: { email: true, firstName: true, lastName: true } }, approvedBy: { select: { email: true, firstName: true, lastName: true } } },
    });
  }

  async removeExpense(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.expense.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
