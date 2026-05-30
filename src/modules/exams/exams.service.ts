import { BadRequestException, Injectable } from '@nestjs/common';
import { ExamType, Prisma, UserRole } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { CreateGradingSchemeDto } from './dto/create-grading-scheme.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  private async userScope(user?: RequestUser, organizationId?: string) {
    return Promise.all([
      user?.role === UserRole.STUDENT ? this.prisma.student.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } }) : Promise.resolve(null),
      user?.role === UserRole.TEACHER ? this.prisma.teacher.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } }) : Promise.resolve(null),
    ]);
  }

  async findAll(query: PaginationQueryDto & { courseId?: string; courseOfferingId?: string; courseName?: string; type?: ExamType }, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const [student, teacher] = await this.userScope(user, organizationId);
    const where: Prisma.ExamWhereInput = {
      organizationId,
      courseId: query.courseId,
      courseOfferingId: query.courseOfferingId,
      type: query.type,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: 'insensitive' } },
            { course: { name: { contains: query.search, mode: 'insensitive' } } },
            { courseOffering: { course: { name: { contains: query.search, mode: 'insensitive' } } } },
          ]
        : undefined,
      courseOffering: student?.id
        ? { registrations: { some: { studentId: student.id } }, ...(query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' as const } } } : {}) }
        : teacher?.id
          ? { instructorId: teacher.id, ...(query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' as const } } } : {}) }
          : query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip,
        take,
        include: {
          course: true,
          room: true,
          courseOffering: { include: { course: true, semester: true } },
          schedules: { include: { room: true, invigilator: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } } },
          _count: { select: { results: true, schedules: true } },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.exam.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.exam.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        course: true,
        room: true,
        courseOffering: { include: { course: true, semester: true } },
        schedules: { include: { room: true, invigilator: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } } },
        results: true,
      },
    });
  }

  async create(dto: CreateExamDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    if (!dto.courseId && !dto.courseOfferingId) throw new BadRequestException('Select a course or course offering');

    const [offering, course, room] = await Promise.all([
      dto.courseOfferingId
        ? this.prisma.courseOffering.findFirst({
            where: { id: dto.courseOfferingId, organizationId, deletedAt: null },
            select: { id: true, courseId: true },
          })
        : Promise.resolve(null),
      dto.courseId
        ? this.prisma.course.findFirst({
            where: { id: dto.courseId, organizationId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
      dto.roomId
        ? this.prisma.room.findFirst({
            where: { id: dto.roomId, organizationId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (dto.courseOfferingId && !offering) throw new BadRequestException('Selected course offering does not exist');
    if (dto.courseId && !course) throw new BadRequestException('Selected course does not exist');
    if (dto.roomId && !room) throw new BadRequestException('Selected room does not exist');

    return this.prisma.exam.create({
      data: {
        organizationId,
        courseOfferingId: dto.courseOfferingId,
        courseId: dto.courseId || offering?.courseId,
        roomId: dto.roomId,
        title: dto.title.trim(),
        date: dto.date,
        type: dto.type,
        durationMinutes: dto.durationMinutes,
        weight: dto.weight,
        passMark: dto.passMark,
        maxScore: dto.maxScore,
      },
      include: { course: true, room: true, courseOffering: { include: { course: true, semester: true } } },
    });
  }

  async update(id: string, dto: UpdateExamDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.exam.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.exam.update({ where: { id }, data: dto, include: { courseOffering: { include: { course: true } } } });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.exam.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.exam.delete({ where: { id } });
  }

  async schedules(query: PaginationQueryDto & { examId?: string; roomId?: string; invigilatorId?: string }, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const [student, teacher] = await this.userScope(user, organizationId);
    const where: Prisma.ExamScheduleWhereInput = {
      organizationId,
      examId: query.examId,
      roomId: query.roomId,
      invigilatorId: teacher?.id ? undefined : query.invigilatorId,
      exam: student?.id
        ? { courseOffering: { registrations: { some: { studentId: student.id } } } }
        : teacher?.id
          ? { courseOffering: { instructorId: teacher.id } }
          : undefined,
      OR: teacher?.id ? [{ invigilatorId: teacher.id }, { exam: { courseOffering: { instructorId: teacher.id } } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.examSchedule.findMany({
        where,
        skip,
        take,
        include: {
          exam: { include: { courseOffering: { include: { course: true } }, course: true } },
          room: true,
          invigilator: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.examSchedule.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createSchedule(dto: CreateExamScheduleDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    if (dto.endTime <= dto.startTime) throw new BadRequestException('End time must be after start time');

    const [exam, room, invigilator, roomConflict, invigilatorConflict] = await Promise.all([
      this.prisma.exam.findFirst({ where: { id: dto.examId, organizationId }, select: { id: true } }),
      this.prisma.room.findFirst({ where: { id: dto.roomId, organizationId, deletedAt: null }, select: { id: true } }),
      dto.invigilatorId
        ? this.prisma.teacher.findFirst({ where: { id: dto.invigilatorId, organizationId, deletedAt: null }, select: { id: true } })
        : Promise.resolve(null),
      this.prisma.examSchedule.findFirst({
        where: { organizationId, roomId: dto.roomId, startTime: { lt: dto.endTime }, endTime: { gt: dto.startTime } },
        select: { id: true },
      }),
      dto.invigilatorId
        ? this.prisma.examSchedule.findFirst({
            where: { organizationId, invigilatorId: dto.invigilatorId, startTime: { lt: dto.endTime }, endTime: { gt: dto.startTime } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!exam) throw new BadRequestException('Selected exam does not exist');
    if (!room) throw new BadRequestException('Selected room does not exist');
    if (dto.invigilatorId && !invigilator) throw new BadRequestException('Selected invigilator does not exist');
    if (roomConflict) throw new BadRequestException('Room is already scheduled during this exam window');
    if (invigilatorConflict) throw new BadRequestException('Invigilator is already scheduled during this exam window');

    return this.prisma.examSchedule.create({
      data: {
        organizationId,
        examId: dto.examId,
        roomId: dto.roomId,
        invigilatorId: dto.invigilatorId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        notes: dto.notes?.trim() || undefined,
      },
      include: {
        exam: { include: { courseOffering: { include: { course: true } }, course: true } },
        room: true,
        invigilator: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async gradingSchemes(query: PaginationQueryDto & { courseOfferingId?: string; examType?: ExamType }, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const [student, teacher] = await this.userScope(user, organizationId);
    const where: Prisma.GradingSchemeWhereInput = {
      organizationId,
      courseOfferingId: query.courseOfferingId,
      examType: query.examType,
      courseOffering: student?.id
        ? { registrations: { some: { studentId: student.id } } }
        : teacher?.id
          ? { instructorId: teacher.id }
          : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.gradingScheme.findMany({
        where,
        skip,
        take,
        include: { courseOffering: { include: { course: true, semester: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gradingScheme.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createGradingScheme(dto: CreateGradingSchemeDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const offering = await this.prisma.courseOffering.findFirst({
      where: { id: dto.courseOfferingId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!offering) throw new BadRequestException('Selected course offering does not exist');

    const aggregate = await this.prisma.gradingScheme.aggregate({
      where: { courseOfferingId: dto.courseOfferingId },
      _sum: { weight: true },
    });
    const existingWeight = Number(aggregate._sum.weight || 0);
    if (existingWeight + Number(dto.weight) > 100) throw new BadRequestException('Grading scheme weights cannot exceed 100%');

    return this.prisma.gradingScheme.create({
      data: {
        organizationId,
        courseOfferingId: dto.courseOfferingId,
        examType: dto.examType,
        title: dto.title?.trim() || undefined,
        weight: dto.weight,
        minimumScore: dto.minimumScore,
        isRequired: dto.isRequired ?? true,
      },
      include: { courseOffering: { include: { course: true, semester: true } } },
    });
  }
}
