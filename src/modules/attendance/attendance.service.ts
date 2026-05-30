import { BadRequestException, Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma, UserRole } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateAttendanceRelations(organizationId: string, dto: { studentId?: string; courseId?: string; courseOfferingId?: string }) {
    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } });
      if (!student) throw new BadRequestException('Selected student does not exist');
    }
    if (dto.courseId) {
      const course = await this.prisma.course.findFirst({ where: { id: dto.courseId, organizationId, deletedAt: null }, select: { id: true } });
      if (!course) throw new BadRequestException('Selected course does not exist');
    }
    if (dto.courseOfferingId) {
      const offering = await this.prisma.courseOffering.findFirst({ where: { id: dto.courseOfferingId, organizationId, deletedAt: null }, select: { id: true } });
      if (!offering) throw new BadRequestException('Selected course offering does not exist');
    }
  }

  async findAll(query: PaginationQueryDto & { studentId?: string; courseId?: string; courseName?: string; status?: AttendanceStatus }, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const [student, teacher] = await Promise.all([
      user?.role === UserRole.STUDENT ? this.prisma.student.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } }) : Promise.resolve(null),
      user?.role === UserRole.TEACHER ? this.prisma.teacher.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } }) : Promise.resolve(null),
    ]);
    const where: Prisma.AttendanceWhereInput = {
      organizationId,
      studentId: student?.id || query.studentId,
      courseId: query.courseId,
      status: query.status,
      courseOffering: teacher?.id
        ? { instructorId: teacher.id, ...(query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' as const } } } : {}) }
        : query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' } } } : undefined,
    };
    const include = { student: true, courseOffering: { include: { course: true } } };
    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({ where, skip, take, include, orderBy: { date: 'desc' } }),
      this.prisma.attendance.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.attendance.findFirstOrThrow({ where: { id, organizationId }, include: { student: true, courseOffering: { include: { course: true } } } });
  }

  async create(dto: CreateAttendanceDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    if (!dto.courseId && !dto.courseOfferingId) {
      throw new BadRequestException('Select a course before marking attendance');
    }

    const [student, courseOffering] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      dto.courseOfferingId
        ? this.prisma.courseOffering.findFirst({
            where: { id: dto.courseOfferingId, organizationId },
            select: { id: true, courseId: true },
          })
        : this.prisma.courseOffering.findFirst({
            where: { courseId: dto.courseId, organizationId },
            select: { id: true, courseId: true },
            orderBy: { createdAt: 'desc' },
          }),
    ]);

    if (!student) throw new BadRequestException('Selected student does not exist');
    if (dto.courseOfferingId && !courseOffering) throw new BadRequestException('Selected course does not exist');
    if (!courseOffering && !dto.courseId) throw new BadRequestException('Selected course does not have an offering');

    return this.prisma.attendance.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        courseId: dto.courseId || courseOffering?.courseId,
        courseOfferingId: dto.courseOfferingId || courseOffering?.id,
        date: dto.date,
        status: dto.status,
      },
      include: { student: true, courseOffering: { include: { course: true } } },
    });
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.attendance.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    await this.validateAttendanceRelations(organizationId, dto);
    return this.prisma.attendance.update({ where: { id }, data: dto, include: { student: true, courseOffering: { include: { course: true } } } });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.attendance.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.attendance.delete({ where: { id } });
  }
}
