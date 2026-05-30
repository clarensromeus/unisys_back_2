import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto & { role?: string; accountRole?: string; userEmail?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.StaffWhereInput = {
      organizationId,
      deletedAt: null,
      role: query.role ? { equals: query.role, mode: 'insensitive' } : undefined,
      user: query.userEmail || query.accountRole ? {
        email: query.userEmail ? { equals: query.userEmail, mode: 'insensitive' } : undefined,
        role: query.accountRole as never,
      } : undefined,
      OR: query.search ? [{ role: { contains: query.search, mode: 'insensitive' } }, { user: { email: { contains: query.search, mode: 'insensitive' } } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, email: true, role: true, firstName: true, lastName: true } },
          employee: { include: { headedDepartment: true, headedFaculty: true } },
        },
      }),
      this.prisma.staff.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.staff.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      include: { user: { select: { id: true, email: true, role: true, firstName: true, lastName: true } }, employee: { include: { headedDepartment: true, headedFaculty: true } } },
    });
  }

  async create(dto: CreateStaffDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: dto.userId, organizationId, deletedAt: null },
        include: { staff: true },
      });
      if (!user) throw new BadRequestException('Selected user does not exist');
      if (user.staff) throw new BadRequestException('Selected user is already linked to a staff record');
      if (dto.accountRole) {
        await tx.user.update({ where: { id: dto.userId }, data: { role: dto.accountRole } });
      }

      const existingEmployee = await tx.employee.findUnique({ where: { userId: dto.userId } });
      const employee = existingEmployee
        ? await tx.employee.update({
            where: { id: existingEmployee.id },
            data: {
              employeeType: existingEmployee.employeeType === 'ACADEMIC' ? 'BOTH' : existingEmployee.employeeType,
              designation: existingEmployee.designation || dto.role.trim(),
            },
          })
        : await tx.employee.create({
            data: {
              organizationId,
              userId: dto.userId,
              employeeType: 'ADMINISTRATIVE',
              designation: dto.role.trim(),
            },
          });

      return tx.staff.create({
        data: {
          organizationId,
          userId: dto.userId,
          role: dto.role.trim(),
          salary: dto.salary,
          employeeId: employee.id,
        },
        include: { user: true, employee: { include: { headedDepartment: true, headedFaculty: true } } },
      });
    });
  }

  async update(id: string, dto: UpdateStaffDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.staff.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.staff.update({ where: { id }, data: dto, include: { user: true, employee: { include: { headedDepartment: true, headedFaculty: true } } } });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.staff.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.staff.delete({ where: { id } });
  }
}
