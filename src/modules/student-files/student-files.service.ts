import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StudentFileRequestStatus, StudentFileRequestType, StudentFileStatus, UserRole } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { CreateFileRequestDto } from './dto/create-file-request.dto';
import { ReviewFileRequestDto } from './dto/review-file-request.dto';

@Injectable()
export class StudentFilesService {
  constructor(private readonly prisma: PrismaService) {}

  private include = {
    student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true } },
    _count: { select: { requests: true } },
  };

  private requestInclude = {
    student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
    studentFile: true,
    requestedBy: { select: { email: true, firstName: true, lastName: true } },
    reviewedBy: { select: { email: true, firstName: true, lastName: true } },
  };

  private async studentForUser(user: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const student = await this.prisma.student.findFirst({ where: { userId: user.id, organizationId } });
    if (!student) throw new ForbiddenException('Student profile required for this action');
    return student;
  }

  async files(query: PaginationQueryDto & { status?: StudentFileStatus }, user: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const student = user.role === UserRole.STUDENT ? await this.studentForUser(user) : null;
    const where: Prisma.StudentFileWhereInput = {
      organizationId,
      deletedAt: null,
      studentId: student?.id,
      status: query.status,
      OR: query.search
        ? [
            { fileNo: { contains: query.search, mode: 'insensitive' } },
            { title: { contains: query.search, mode: 'insensitive' } },
            { student: { studentId: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.studentFile.findMany({ where, skip, take, include: this.include, orderBy: { updatedAt: 'desc' } }),
      this.prisma.studentFile.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async requests(query: PaginationQueryDto & { status?: StudentFileRequestStatus; type?: StudentFileRequestType }, user: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const student = user.role === UserRole.STUDENT ? await this.studentForUser(user) : null;
    const where: Prisma.StudentFileRequestWhereInput = {
      organizationId,
      studentId: student?.id,
      status: query.status,
      type: query.type,
      OR: query.search
        ? [
            { reason: { contains: query.search, mode: 'insensitive' } },
            { student: { studentId: { contains: query.search, mode: 'insensitive' } } },
            { studentFile: { fileNo: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.studentFileRequest.findMany({ where, skip, take, include: this.requestInclude, orderBy: { createdAt: 'desc' } }),
      this.prisma.studentFileRequest.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createRequest(dto: CreateFileRequestDto, user: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const student = user.role === UserRole.STUDENT
      ? await this.studentForUser(user)
      : dto.studentId
        ? await this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null } })
        : null;
    if (!student) throw new NotFoundException('Student not found');

    const existingFile = dto.studentFileId
      ? await this.prisma.studentFile.findFirst({ where: { id: dto.studentFileId, organizationId, studentId: student.id, deletedAt: null } })
      : await this.prisma.studentFile.findFirst({
          where: { organizationId, studentId: student.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });

    if (dto.type === StudentFileRequestType.CLOSE && !existingFile) {
      throw new NotFoundException('No student file exists to close');
    }

    return this.prisma.studentFileRequest.create({
      data: {
        organizationId,
        studentId: student.id,
        studentFileId: existingFile?.id,
        requestedById: user.id,
        type: dto.type,
        reason: dto.reason,
      },
      include: this.requestInclude,
    });
  }

  async reviewRequest(id: string, dto: ReviewFileRequestDto, user: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const request = await this.prisma.studentFileRequest.findUnique({ where: { id }, include: { student: true, studentFile: true } });
    if (!request || request.organizationId !== organizationId) throw new NotFoundException('Request not found');
    if (request.status !== StudentFileRequestStatus.PENDING) throw new ForbiddenException('Only pending requests can be reviewed');
    if (dto.status !== StudentFileRequestStatus.APPROVED && dto.status !== StudentFileRequestStatus.REJECTED) {
      throw new ForbiddenException('Review status must be approved or rejected');
    }

    return this.prisma.$transaction(async (tx) => {
      let fileId = request.studentFileId;
      if (dto.status === StudentFileRequestStatus.APPROVED) {
        if (request.type === StudentFileRequestType.OPEN) {
          const file = request.studentFile ?? await tx.studentFile.create({
            data: {
              organizationId,
              studentId: request.studentId,
              fileNo: `${request.student.studentId}-FILE-${Date.now()}`,
              title: `${request.student.studentId} Academic File`,
              status: StudentFileStatus.OPEN,
            },
          });
          fileId = file.id;
          await tx.studentFile.update({
            where: { id: file.id },
            data: { status: StudentFileStatus.OPEN, closedAt: null, closedReason: null },
          });
        }
        if (request.type === StudentFileRequestType.CLOSE && request.studentFileId) {
          await tx.studentFile.update({
            where: { id: request.studentFileId },
            data: { status: StudentFileStatus.CLOSED, closedAt: new Date(), closedReason: request.reason },
          });
        }
      }

      return tx.studentFileRequest.update({
        where: { id },
        data: {
          studentFileId: fileId,
          status: dto.status,
          responseNote: dto.responseNote,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
        include: this.requestInclude,
      });
    });
  }
}
