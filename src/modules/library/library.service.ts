import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateBorrowDto } from './dto/create-borrow.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { notifyUser } from '../../common/utils/notification.util';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  private async notifyOverdueBorrows(organizationId: string) {
    const overdue = await this.prisma.borrow.findMany({
      where: {
        organizationId,
        returned: false,
        status: { in: ['BORROWED', 'OVERDUE'] },
        dueDate: { lt: new Date() },
      },
      include: { student: { include: { user: { select: { id: true } } } }, book: true },
      take: 50,
    });

    for (const borrow of overdue) {
      if (borrow.status !== 'OVERDUE') {
        await this.prisma.borrow.update({ where: { id: borrow.id }, data: { status: 'OVERDUE' } });
      }
      const days = Math.max(1, Math.ceil((Date.now() - borrow.dueDate.getTime()) / 86_400_000));
      await notifyUser(this.prisma, {
        organizationId,
        userId: borrow.student.user.id,
        type: 'LIBRARY',
        priority: 'URGENT',
        title: 'Library book overdue',
        body: `Your borrowed book "${borrow.book.title}" is ${days} ${days === 1 ? 'day' : 'days'} overdue.`,
        entityType: 'Borrow',
        entityId: borrow.id,
        link: '/library',
        dedupeKey: borrow.id,
      });
    }
  }

  async books(query: PaginationQueryDto & { title?: string; author?: string; categoryName?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.notifyOverdueBorrows(organizationId);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.BookWhereInput = {
      organizationId,
      deletedAt: null,
      title: query.title ? { equals: query.title, mode: 'insensitive' } : undefined,
      author: query.author ? { equals: query.author, mode: 'insensitive' } : undefined,
      category: query.categoryName ? { name: { equals: query.categoryName, mode: 'insensitive' } } : undefined,
      OR: query.search ? [{ title: { contains: query.search, mode: 'insensitive' } }, { author: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.book.findMany({ where, skip, take, include: { category: true, _count: { select: { borrows: true, reservations: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.book.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async book(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.book.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, include: { category: true, borrows: true, reservations: true } });
  }

  async createBook(dto: CreateBookDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    if (dto.categoryId) {
      const category = await this.prisma.bookCategory.findFirst({ where: { id: dto.categoryId, organizationId }, select: { id: true } });
      if (!category) throw new BadRequestException('Book category does not exist for the current organization');
    }
    return this.prisma.book.create({
      data: {
        ...dto,
        organizationId,
        isbn: dto.isbn?.trim() || `ISBN-${Date.now()}`,
        availableCopies: dto.availableCopies ?? dto.copies,
      },
      include: { category: true, _count: { select: { borrows: true, reservations: true } } },
    });
  }

  async updateBook(id: string, dto: UpdateBookDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const book = await this.prisma.book.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!book) throw new BadRequestException('Book does not exist for the current organization');
    if (dto.categoryId) {
      const category = await this.prisma.bookCategory.findFirst({ where: { id: dto.categoryId, organizationId }, select: { id: true } });
      if (!category) throw new BadRequestException('Book category does not exist for the current organization');
    }
    return this.prisma.book.update({
      where: { id },
      data: { ...dto, isbn: dto.isbn?.trim() },
      include: { category: true, _count: { select: { borrows: true, reservations: true } } },
    });
  }

  async removeBook(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const book = await this.prisma.book.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!book) throw new BadRequestException('Book does not exist for the current organization');
    return this.prisma.book.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async borrows(query: PaginationQueryDto & { studentId?: string; bookId?: string; returned?: boolean | string; status?: string; bookTitle?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.notifyOverdueBorrows(organizationId);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.BorrowWhereInput = {
      organizationId,
      studentId: query.studentId,
      bookId: query.bookId,
      returned: query.returned === undefined ? undefined : String(query.returned) === 'true',
      status: query.status as never,
      book: query.bookTitle ? { title: { equals: query.bookTitle, mode: 'insensitive' } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.borrow.findMany({ where, skip, take, include: { student: true, book: true }, orderBy: { dueDate: 'asc' } }),
      this.prisma.borrow.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createBorrow(dto: CreateBorrowDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const [student, book] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } }),
      this.prisma.book.findFirst({ where: { id: dto.bookId, organizationId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!student) throw new BadRequestException('Selected student does not exist');
    if (!book) throw new BadRequestException('Selected book does not exist');
    const borrow = await this.prisma.borrow.create({
      data: { ...dto, organizationId, status: new Date(dto.dueDate) < new Date() ? 'OVERDUE' : 'BORROWED' },
      include: { student: { include: { user: { select: { id: true } } } }, book: true },
    });
    if (borrow.status === 'OVERDUE') await this.notifyOverdueBorrows(organizationId);
    return borrow;
  }

  async returnBook(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.borrow.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.borrow.update({ where: { id }, data: { returned: true }, include: { student: true, book: true } });
  }
}
