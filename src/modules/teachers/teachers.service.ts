import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { hashSecret } from '../../common/utils/password.util';
import { AssignTeacherCoursesDto } from './dto/assign-teacher-courses.dto';

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async validateDepartment(organizationId: string, departmentId?: string) {
    if (!departmentId) return;
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!department) throw new BadRequestException('Selected department does not exist');
  }

  async findAll(query: PaginationQueryDto & { name?: string; departmentId?: string; departmentName?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.TeacherWhereInput = {
      organizationId,
      deletedAt: null,
      departmentId: query.departmentId,
      department: query.departmentName ? { name: { equals: query.departmentName, mode: 'insensitive' } } : undefined,
      user: query.name ? { email: { contains: query.name, mode: 'insensitive' } } : undefined,
      OR: query.search
        ? [
            { specialization: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { department: { name: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          employee: { include: { headedDepartment: true, headedFaculty: true } },
          department: true,
          courses: true,
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.teacher.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        employee: { include: { headedDepartment: true, headedFaculty: true } },
        department: true,
        courses: true,
      },
    });
  }

  async create(dto: CreateTeacherDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    if (!dto.userId && !dto.email) throw new BadRequestException('Provide an existing user or teacher email.');
    await this.validateDepartment(organizationId, dto.departmentId);

    return this.prisma.$transaction(async (tx) => {
      const userId = dto.userId
        ? (await tx.user.findFirstOrThrow({
            where: { id: dto.userId, organizationId, deletedAt: null },
            select: { id: true },
          })).id
        : (await tx.user.create({
            data: {
              organizationId,
              email: dto.email!,
              role: UserRole.TEACHER,
              firstName: dto.firstName?.trim() || undefined,
              lastName: dto.lastName?.trim() || undefined,
              password: await hashSecret(dto.password || 'Password123!', this.config.get<number>('bcryptRounds') ?? 12),
            },
            select: { id: true },
          })).id;

      const existingEmployee = await tx.employee.findUnique({ where: { userId } });
      const employee = existingEmployee
        ? await tx.employee.update({
            where: { id: existingEmployee.id },
            data: {
              employeeType: existingEmployee.employeeType === 'ADMINISTRATIVE' ? 'BOTH' : existingEmployee.employeeType,
              employeeNo: existingEmployee.employeeNo || dto.employeeNo?.trim() || undefined,
              designation: existingEmployee.designation || dto.specialization.trim(),
            },
          })
        : await tx.employee.create({
            data: {
              organizationId,
              userId,
              employeeNo: dto.employeeNo?.trim() || undefined,
              employeeType: 'ACADEMIC',
              designation: dto.specialization.trim(),
            },
          });

      return tx.teacher.create({
        data: {
          organizationId,
          userId,
          employeeId: employee.id,
          departmentId: dto.departmentId,
          employeeNo: dto.employeeNo?.trim() || undefined,
          specialization: dto.specialization.trim(),
          officeLocation: dto.officeLocation?.trim() || undefined,
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          employee: { include: { headedDepartment: true, headedFaculty: true } },
          department: true,
          courses: true,
        },
      });
    });
  }

  async update(id: string, dto: UpdateTeacherDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.teacher.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    await this.validateDepartment(organizationId, dto.departmentId);
    return this.prisma.teacher.update({
      where: { id },
      data: {
        departmentId: dto.departmentId,
        employeeNo: dto.employeeNo,
        specialization: dto.specialization,
        officeLocation: dto.officeLocation,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        employee: { include: { headedDepartment: true, headedFaculty: true } },
        department: true,
        courses: true,
      },
    });
  }

  async assignCourses(id: string, dto: AssignTeacherCoursesDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const teacher = await this.prisma.teacher.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { organizationId: true } });
    const courseIds = dto.courseIds || [];
    if (courseIds.length) {
      const total = await this.prisma.course.count({
        where: { id: { in: courseIds }, organizationId: teacher.organizationId, deletedAt: null },
      });
      if (total !== courseIds.length) throw new BadRequestException('One or more courses do not belong to this organization.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.course.updateMany({ where: { teacherId: id, organizationId: teacher.organizationId }, data: { teacherId: null } });
      if (courseIds.length) {
        await tx.course.updateMany({
          where: { id: { in: courseIds }, organizationId: teacher.organizationId },
          data: { teacherId: id },
        });
      }
      return tx.teacher.findUniqueOrThrow({
        where: { id },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          employee: { include: { headedDepartment: true, headedFaculty: true } },
          department: true,
          courses: true,
        },
      });
    });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.teacher.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.teacher.delete({ where: { id } });
  }
}
