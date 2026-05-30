import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCoursePrerequisiteDto } from './dto/create-course-prerequisite.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateCourseRelations(organizationId: string, dto: { departmentId?: string; teacherId?: string }) {
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!department) throw new BadRequestException('Selected department does not exist');
    }
    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!teacher) throw new BadRequestException('Selected teacher does not exist');
    }
  }

  async findAll(query: PaginationQueryDto & { code?: string; name?: string; departmentId?: string; departmentName?: string; teacherId?: string; teacherName?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.CourseWhereInput = {
      organizationId,
      deletedAt: null,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      departmentId: query.departmentId,
      teacherId: query.teacherId,
      department: query.departmentName ? { name: { equals: query.departmentName, mode: 'insensitive' } } : undefined,
      teacher: query.teacherName ? { user: { email: { contains: query.teacherName, mode: 'insensitive' } } } : undefined,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
            { department: { name: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take,
        include: { department: true, teacher: { include: { user: { select: { email: true } } } }, _count: { select: { registrations: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const student = user?.role === UserRole.STUDENT
      ? await this.prisma.student.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } })
      : null;
    return this.prisma.course.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      include: {
        department: true,
        teacher: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        programCourses: { include: { program: true } },
        prerequisites: { include: { prerequisiteCourse: true } },
        requiredFor: { include: { course: true } },
        registrations: {
          where: { status: 'ENROLLED', studentId: student?.id },
          include: {
            student: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
                department: true,
                program: true,
              },
            },
            courseOffering: { include: { semester: true } },
          },
          orderBy: { registeredAt: 'desc' },
        },
        offerings: {
          include: {
            semester: true,
            instructor: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
            _count: { select: { registrations: true, exams: true, timetables: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(dto: CreateCourseDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.validateCourseRelations(organizationId, dto);
    return this.prisma.course.create({
      data: {
        ...dto,
        organizationId,
        creditHours: Number(dto.creditHours || 3),
      },
      include: { department: true, teacher: true },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.course.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    await this.validateCourseRelations(organizationId, dto);
    return this.prisma.course.update({ where: { id }, data: dto, include: { department: true, teacher: true } });
  }

  async assignPrerequisite(id: string, dto: CreateCoursePrerequisiteDto) {
    if (id === dto.prerequisiteCourseId) {
      throw new BadRequestException('A course cannot be its own prerequisite');
    }

    const organizationId = await defaultOrganizationId(this.prisma);
    const course = await this.prisma.course.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, organizationId: true },
    });

    const prerequisite = await this.prisma.course.findFirst({
      where: { id: dto.prerequisiteCourseId, organizationId: course.organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!prerequisite) {
      throw new BadRequestException('Selected prerequisite course does not exist');
    }

    const directCycle = await this.prisma.coursePrerequisite.findUnique({
      where: {
        courseId_prerequisiteCourseId: {
          courseId: dto.prerequisiteCourseId,
          prerequisiteCourseId: id,
        },
      },
      select: { id: true },
    });

    if (directCycle) {
      throw new BadRequestException('This prerequisite would create a circular course dependency');
    }

    return this.prisma.coursePrerequisite.upsert({
      where: {
        courseId_prerequisiteCourseId: {
          courseId: id,
          prerequisiteCourseId: dto.prerequisiteCourseId,
        },
      },
      update: { minimumGrade: dto.minimumGrade?.trim() || null },
      create: {
        courseId: id,
        prerequisiteCourseId: dto.prerequisiteCourseId,
        minimumGrade: dto.minimumGrade?.trim() || null,
      },
      include: { prerequisiteCourse: true },
    });
  }

  async removePrerequisite(id: string, prerequisiteCourseId: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.course.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.coursePrerequisite.delete({
      where: {
        courseId_prerequisiteCourseId: {
          courseId: id,
          prerequisiteCourseId,
        },
      },
    });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.course.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.course.delete({ where: { id } });
  }
}
