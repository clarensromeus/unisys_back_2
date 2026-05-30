import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, StudentStatus, UserRole } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateStudentRelations(organizationId: string, dto: { userId?: string; departmentId?: string }) {
    if (dto.userId) {
      const user = await this.prisma.user.findFirst({ where: { id: dto.userId, organizationId, deletedAt: null }, select: { id: true } });
      if (!user) throw new ForbiddenException('Selected user does not belong to this organization');
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({ where: { id: dto.departmentId, organizationId, deletedAt: null }, select: { id: true } });
      if (!department) throw new ForbiddenException('Selected department does not belong to this organization');
    }
  }

  async findAll(query: PaginationQueryDto & { departmentId?: string; departmentName?: string; status?: StudentStatus }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const statuses = query.statuses
      ?.split(',')
      .map((status) => status.trim())
      .filter(Boolean) as StudentStatus[] | undefined;
    const where: Prisma.StudentWhereInput = {
      organizationId,
      departmentId: query.departmentId,
      status: query.status ? query.status : statuses?.length ? { in: statuses } : undefined,
      department: query.departmentName ? { name: { equals: query.departmentName, mode: 'insensitive' } } : undefined,
      OR: query.search
        ? [
            { studentId: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { department: { name: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true } },
          department: true,
          program: true,
          _count: { select: { attendance: true, registrations: true, invoices: true, files: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        user: { select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true, isActive: true, createdAt: true } },
        department: { include: { faculty: true, head: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } } },
        program: { include: { faculty: true, department: true } },
        application: { include: { program: true, reviewedBy: { select: { email: true, firstName: true, lastName: true } }, documents: true } },
        registrations: {
          take: 30,
          orderBy: { registeredAt: 'desc' },
          include: {
            courseOffering: {
              include: {
                course: true,
                semester: true,
                instructor: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
              },
            },
          },
        },
        attendance: {
          take: 60,
          orderBy: { date: 'desc' },
          include: { courseOffering: { include: { course: true, semester: true } } },
        },
        results: {
          take: 40,
          orderBy: { createdAt: 'desc' },
          include: { exam: { include: { courseOffering: { include: { course: true, semester: true } } } } },
        },
        progression: { take: 20, orderBy: { createdAt: 'desc' } },
        invoices: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: { semester: true, items: true, payments: true },
        },
        payments: { take: 30, orderBy: { paidAt: 'desc' }, include: { invoice: true } },
        transactions: { take: 30, orderBy: { createdAt: 'desc' } },
        scholarships: { include: { scholarship: true } },
        holds: { take: 20, orderBy: { createdAt: 'desc' } },
        files: { take: 20, orderBy: { createdAt: 'desc' }, include: { _count: { select: { requests: true } } } },
        fileRequests: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            studentFile: true,
            requestedBy: { select: { email: true, firstName: true, lastName: true } },
            reviewedBy: { select: { email: true, firstName: true, lastName: true } },
          },
        },
        borrows: { take: 20, orderBy: { dueDate: 'desc' }, include: { book: true } },
        reservations: { take: 20, orderBy: { createdAt: 'desc' }, include: { book: true } },
        hostelAllocations: { take: 10, orderBy: { startsOn: 'desc' }, include: { hostelRoom: { include: { hostel: true, room: true } } } },
      },
    });
    if (user?.role === UserRole.STUDENT && student.user.id !== user.id) {
      throw new ForbiddenException('Students can only view their own student record');
    }
    return student;
  }

  async create(dto: CreateStudentDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.validateStudentRelations(organizationId, dto);
    return this.prisma.student.create({ data: { ...dto, organizationId }, include: { user: true, department: true } });
  }

  async update(id: string, dto: UpdateStudentDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.student.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    await this.validateStudentRelations(organizationId, dto);
    return this.prisma.student.update({ where: { id }, data: dto, include: { user: true, department: true } });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.student.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.student.delete({ where: { id } });
  }
}
