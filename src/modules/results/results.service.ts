import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppealStatus, Prisma, ResultWorkflowStatus, UserRole } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResultAppealDto } from './dto/create-result-appeal.dto';
import { CreateResultDto } from './dto/create-result.dto';
import { CreateTranscriptDto } from './dto/create-transcript.dto';
import { UpdateResultWorkflowDto } from './dto/update-result-workflow.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { UpdateResultAppealDto } from './dto/update-result-appeal.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { notifyUser } from '../../common/utils/notification.util';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  private async userScope(user?: RequestUser, organizationId?: string) {
    return Promise.all([
      user?.role === UserRole.STUDENT ? this.prisma.student.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } }) : Promise.resolve(null),
      user?.role === UserRole.TEACHER ? this.prisma.teacher.findFirst({ where: { userId: user.id, organizationId }, select: { id: true } }) : Promise.resolve(null),
    ]);
  }

  private async validateResultRelations(organizationId: string, dto: { studentId?: string; examId?: string }) {
    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } });
      if (!student) throw new BadRequestException('Selected student does not exist');
    }
    if (dto.examId) {
      const exam = await this.prisma.exam.findFirst({ where: { id: dto.examId, organizationId }, select: { id: true } });
      if (!exam) throw new BadRequestException('Selected exam does not exist');
    }
  }

  private resultCourseName(result: Prisma.ResultGetPayload<{ include: { exam: { include: { course: true; courseOffering: { include: { course: true } } } } } }>) {
    return result.exam?.courseOffering?.course?.name || result.exam?.course?.name || result.exam?.title || 'your course';
  }

  private async notifyResultPublished(result: Prisma.ResultGetPayload<{ include: { student: { include: { user: { select: { id: true } } } }; exam: { include: { course: true; courseOffering: { include: { course: true } } } } } }>) {
    await notifyUser(this.prisma, {
      organizationId: result.organizationId,
      userId: result.student.user.id,
      type: 'RESULT',
      priority: 'HIGH',
      title: 'Result published',
      body: `Your ${this.resultCourseName(result)} result is now available.`,
      entityType: 'Result',
      entityId: result.id,
      link: '/results',
      dedupeKey: result.id,
    });
  }

  private async gradeForScore(organizationId: string, score: number) {
    return this.prisma.gradeScale.findFirst({
      where: {
        organizationId,
        minScore: { lte: score },
        maxScore: { gte: score },
      },
      orderBy: { minScore: 'desc' },
    });
  }

  private async syncRegistrationGrade(resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { exam: true },
    });
    if (!result?.exam.courseOfferingId) return;

    const results = await this.prisma.result.findMany({
      where: {
        studentId: result.studentId,
        exam: { courseOfferingId: result.exam.courseOfferingId },
        OR: [{ isPublished: true }, { status: { in: ['APPROVED', 'PUBLISHED'] } }],
      },
      include: { exam: true },
    });
    const weighted = results.reduce((sum, item) => {
      const maxScore = Number(item.exam.maxScore || 100);
      const weight = Number(item.exam.weight || 0);
      if (!maxScore || !weight) return sum;
      return sum + (Number(item.score) / maxScore) * weight;
    }, 0);
    const totalWeight = results.reduce((sum, item) => sum + Number(item.exam.weight || 0), 0);
    if (!totalWeight) return;

    const normalizedScore = (weighted / totalWeight) * 100;
    const scale = await this.gradeForScore(result.organizationId, normalizedScore);
    await this.prisma.courseRegistration.updateMany({
      where: {
        studentId: result.studentId,
        courseOfferingId: result.exam.courseOfferingId,
      },
      data: {
        finalGrade: scale?.letter || result.grade,
        gradePoints: scale?.gradePoints || result.gradePoints,
      },
    });
  }

  async findAll(query: PaginationQueryDto & { studentId?: string; examId?: string; status?: ResultWorkflowStatus; isPublished?: string }, user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const [student, teacher] = await this.userScope(user, organizationId);
    const where: Prisma.ResultWhereInput = {
      organizationId,
      studentId: student?.id || query.studentId,
      examId: query.examId,
      status: query.status,
      isPublished: student?.id ? true : query.isPublished === undefined ? undefined : ['1', 'true', 'TRUE', 'PUBLISHED'].includes(query.isPublished),
      exam: teacher?.id ? { courseOffering: { instructorId: teacher.id } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.result.findMany({
        where,
        skip,
        take,
        include: {
          student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
          exam: { include: { course: true, courseOffering: { include: { course: true, semester: true } } } },
          gradedBy: { select: { email: true, firstName: true, lastName: true } },
          approvedBy: { select: { email: true, firstName: true, lastName: true } },
          _count: { select: { appeals: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.result.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.result.findFirstOrThrow({
      where: { id, organizationId },
      include: {
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        exam: { include: { course: true, courseOffering: { include: { course: true, semester: true } } } },
        appeals: true,
      },
    });
  }

  async create(dto: CreateResultDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const [student, exam] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } }),
      this.prisma.exam.findFirst({ where: { id: dto.examId, organizationId }, select: { id: true, passMark: true, maxScore: true } }),
    ]);

    if (!student) throw new BadRequestException('Selected student does not exist');
    if (!exam) throw new BadRequestException('Selected exam does not exist');

    const percentage = (Number(dto.score) / Number(exam.maxScore || 100)) * 100;
    const scale = dto.gradePoints === undefined ? await this.gradeForScore(organizationId, percentage) : null;
    const status = dto.status ?? 'DRAFT';
    const result = await this.prisma.result.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        examId: dto.examId,
        score: dto.score,
        grade: dto.grade,
        gradePoints: dto.gradePoints ?? scale?.gradePoints,
        isPassed: dto.isPassed ?? Number(dto.score) >= Number(exam.passMark),
        status,
        isPublished: status === 'PUBLISHED',
        publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
        remarks: dto.remarks?.trim() || undefined,
      },
      include: {
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        exam: { include: { course: true, courseOffering: { include: { course: true, semester: true } } } },
      },
    });

    if (result.isPublished || result.status === 'APPROVED') await this.syncRegistrationGrade(result.id);
    if (result.isPublished) await this.notifyResultPublished(result);
    return result;
  }

  async update(id: string, dto: UpdateResultDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const previous = await this.prisma.result.findFirstOrThrow({ where: { id, organizationId }, select: { isPublished: true, status: true } });
    await this.validateResultRelations(organizationId, dto);
    const result = await this.prisma.result.update({
      where: { id },
      data: dto,
      include: {
        student: { include: { user: { select: { id: true } } } },
        exam: { include: { course: true, courseOffering: { include: { course: true } } } },
      },
    });
    if (result.isPublished || result.status === 'APPROVED') await this.syncRegistrationGrade(result.id);
    if ((result.isPublished || result.status === 'PUBLISHED') && !previous?.isPublished && previous?.status !== 'PUBLISHED') await this.notifyResultPublished(result);
    return result;
  }

  async updateWorkflow(id: string, dto: UpdateResultWorkflowDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const publishing = dto.status === 'PUBLISHED' || dto.isPublished;
    const approving = dto.status === 'APPROVED' || publishing;
    const previous = await this.prisma.result.findFirstOrThrow({ where: { id, organizationId }, select: { isPublished: true, status: true } });
    if (dto.approvedById) {
      const approver = await this.prisma.user.findFirst({ where: { id: dto.approvedById, organizationId, deletedAt: null }, select: { id: true } });
      if (!approver) throw new BadRequestException('Selected approver does not exist');
    }
    const result = await this.prisma.result.update({
      where: { id },
      data: {
        status: dto.status,
        isPublished: publishing ? true : dto.isPublished,
        publishedAt: publishing ? new Date() : undefined,
        approvedById: dto.approvedById,
        approvedAt: approving ? new Date() : undefined,
        approvalNotes: dto.approvalNotes?.trim() || undefined,
      },
      include: {
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        exam: { include: { course: true, courseOffering: { include: { course: true, semester: true } } } },
      },
    });
    if (approving) await this.syncRegistrationGrade(id);
    if (publishing && !previous?.isPublished && previous?.status !== 'PUBLISHED') await this.notifyResultPublished(result);
    return result;
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.result.findFirstOrThrow({ where: { id, organizationId }, select: { id: true } });
    return this.prisma.result.delete({ where: { id } });
  }

  async appeals(query: PaginationQueryDto & { studentId?: string; resultId?: string; status?: AppealStatus }, user?: RequestUser) {
    const { skip, take, page, limit } = pagination(query);
    const organizationId = await defaultOrganizationId(this.prisma);
    const [student, teacher] = await this.userScope(user, organizationId);
    const where: Prisma.ResultAppealWhereInput = {
      organizationId,
      studentId: student?.id || query.studentId,
      resultId: query.resultId,
      status: query.status,
      result: teacher?.id ? { exam: { courseOffering: { instructorId: teacher.id } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.resultAppeal.findMany({
        where,
        skip,
        take,
        include: {
          student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
          result: { include: { exam: { include: { course: true, courseOffering: { include: { course: true } } } } } },
          reviewedBy: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.resultAppeal.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createAppeal(dto: CreateResultAppealDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const result = await this.prisma.result.findFirst({
      where: { id: dto.resultId, organizationId, studentId: dto.studentId },
      select: { id: true, studentId: true },
    });
    if (!result) throw new BadRequestException('Selected result does not exist for this student');

    const appeal = await this.prisma.resultAppeal.create({
      data: {
        organizationId,
        resultId: dto.resultId,
        studentId: dto.studentId,
        reason: dto.reason.trim(),
        status: dto.status ?? 'PENDING',
        newScore: dto.newScore,
        responseNote: dto.responseNote?.trim() || undefined,
      },
      include: {
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        result: { include: { exam: { include: { course: true, courseOffering: { include: { course: true } } } } } },
      },
    });

    if (appeal.status === 'APPROVED' || appeal.status === 'REJECTED') {
      await notifyUser(this.prisma, {
        organizationId,
        userId: appeal.student.user.id,
        type: 'APPEAL',
        title: 'Result appeal reviewed',
        body: `Your result appeal has been reviewed and marked ${appeal.status.toLowerCase()}.${appeal.responseNote ? ` ${appeal.responseNote}` : ''}`,
        entityType: 'ResultAppeal',
        entityId: appeal.id,
        link: '/result-appeals',
      });
    }

    return appeal;
  }

  async updateAppeal(id: string, dto: UpdateResultAppealDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const previous = await this.prisma.resultAppeal.findFirstOrThrow({ where: { id, organizationId }, select: { status: true } });
    const appeal = await this.prisma.resultAppeal.update({
      where: { id },
      data: {
        status: dto.status,
        newScore: dto.newScore,
        responseNote: dto.responseNote?.trim() || undefined,
      },
      include: {
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        result: { include: { exam: { include: { course: true, courseOffering: { include: { course: true } } } } } },
      },
    });

    if ((appeal.status === 'APPROVED' || appeal.status === 'REJECTED') && previous?.status !== appeal.status) {
      await notifyUser(this.prisma, {
        organizationId,
        userId: appeal.student.user.id,
        type: 'APPEAL',
        title: 'Result appeal reviewed',
        body: `Your result appeal has been reviewed and marked ${appeal.status.toLowerCase()}.${appeal.responseNote ? ` ${appeal.responseNote}` : ''}`,
        entityType: 'ResultAppeal',
        entityId: appeal.id,
        link: '/result-appeals',
      });
    }

    return appeal;
  }

  async transcripts(query: PaginationQueryDto & { studentId?: string; isOfficial?: string }, user?: RequestUser) {
    const { skip, take, page, limit } = pagination(query);
    const organizationId = await defaultOrganizationId(this.prisma);
    const [student] = await this.userScope(user, organizationId);
    const where: Prisma.TranscriptWhereInput = {
      organizationId,
      studentId: student?.id || query.studentId,
      isOfficial: query.isOfficial === undefined ? undefined : ['1', 'true', 'TRUE', 'OFFICIAL'].includes(query.isOfficial),
    };
    const [items, total] = await Promise.all([
      this.prisma.transcript.findMany({
        where,
        skip,
        take,
        include: {
          student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true } },
          issuedBy: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.transcript.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createTranscript(dto: CreateTranscriptDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new BadRequestException('Selected student does not exist');

    return this.prisma.transcript.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        isOfficial: dto.isOfficial ?? false,
        verifyCode: `TRN-${randomUUID().slice(0, 8).toUpperCase()}`,
        notes: dto.notes?.trim() || undefined,
      },
      include: {
        student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true } },
      },
    });
  }
}
