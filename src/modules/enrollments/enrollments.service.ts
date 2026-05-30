import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto & { studentId?: string; courseId?: string; semester?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.CourseRegistrationWhereInput = {
      organizationId,
      studentId: query.studentId,
      courseId: query.courseId,
      courseOffering: query.semester
        ? { semester: { name: { equals: query.semester, mode: 'insensitive' } } }
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.courseRegistration.findMany({
        where,
        skip,
        take,
        include: { student: true, course: true, courseOffering: { include: { semester: true } } },
      }),
      this.prisma.courseRegistration.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.courseRegistration.findFirstOrThrow({
      where: { id, organizationId },
      include: { student: true, course: true, courseOffering: { include: { semester: true } } },
    });
  }

  async create(dto: CreateEnrollmentDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const [student, courseOffering] = await Promise.all([
      this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } }),
      this.prisma.courseOffering.findFirstOrThrow({
        where: {
          organizationId,
          courseId: dto.courseId,
          semester: { name: { equals: dto.semester, mode: 'insensitive' } },
        },
        select: { id: true, courseId: true },
      }),
    ]);

    return this.prisma.courseRegistration.create({
      data: {
        organizationId,
        studentId: student.id,
        courseId: courseOffering.courseId,
        courseOfferingId: courseOffering.id,
      },
      include: { student: true, course: true, courseOffering: { include: { semester: true } } },
    });
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const current = await this.prisma.courseRegistration.findFirstOrThrow({
      where: { id, organizationId },
      select: { courseId: true, courseOffering: { select: { semester: { select: { name: true } } } } },
    });
    const courseId = dto.courseId ?? current.courseId;
    const semester = dto.semester ?? current.courseOffering.semester.name;
    const courseOffering = await this.prisma.courseOffering.findFirstOrThrow({
      where: { organizationId, courseId, semester: { name: { equals: semester, mode: 'insensitive' } } },
      select: { id: true },
    });
    if (dto.studentId) {
      await this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } });
    }

    return this.prisma.courseRegistration.update({
      where: { id },
      data: {
        student: dto.studentId ? { connect: { id: dto.studentId } } : undefined,
        course: { connect: { id: courseId } },
        courseOffering: { connect: { id: courseOffering.id } },
      },
      include: { student: true, course: true, courseOffering: { include: { semester: true } } },
    });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.courseRegistration.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.courseRegistration.delete({ where: { id } });
  }
}
