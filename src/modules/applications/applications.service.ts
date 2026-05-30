import { randomBytes } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdmissionStatus, Prisma, StudentStatus, UserRole } from '@prisma/client';
import { EmailService } from '../../common/utils/email.service';
import { hashSecret } from '../../common/utils/password.util';
import { notifyUser } from '../../common/utils/notification.util';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDocumentDto } from './dto/create-application-document.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { SubmitApplicationDocumentsDto } from './dto/submit-application-documents.dto';
import { TrackApplicationDto } from './dto/track-application.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

const applicationInclude = {
  program: { include: { department: true, faculty: true } },
  student: { include: { user: { select: { id: true, email: true, role: true, firstName: true, lastName: true } } } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
  reviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async create(dto: CreateApplicationDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.program.findFirstOrThrow({
      where: { id: dto.programId, organizationId, deletedAt: null },
      select: { id: true },
    });

    const application = await this.prisma.admissionApplication.create({
      data: {
        organizationId,
        programId: dto.programId,
        applicantEmail: dto.applicantEmail.toLowerCase(),
        applicantName: dto.applicantName.trim(),
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
        nationality: dto.nationality,
        previousSchool: dto.previousSchool,
        applicationCode: await this.nextApplicationCode(organizationId),
        accessToken: this.newAccessToken(),
      },
      include: applicationInclude,
    });

    await Promise.all([
      this.sendApplicationCodeEmail(application),
      this.notifyApplicantIfUserExists(application),
    ]);

    return application;
  }

  async programs() {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.program.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, code: true, name: true, level: true, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async track(query: TrackApplicationDto) {
    return this.prisma.admissionApplication.findFirstOrThrow({
      where: {
        applicationCode: query.applicationCode,
        deletedAt: null,
      },
      select: {
        id: true,
        applicationCode: true,
        applicantName: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        decisionNotes: true,
        program: { select: { code: true, name: true, level: true, department: { select: { name: true } } } },
        documents: { select: { id: true, name: true, fileUrl: true, uploadedAt: true }, orderBy: { uploadedAt: 'desc' } },
      },
    });
  }

  async submitDocuments(dto: SubmitApplicationDocumentsDto) {
    const application = await this.prisma.admissionApplication.findFirst({
      where: { applicationCode: dto.applicationCode, deletedAt: null },
      select: { id: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    return this.prisma.$transaction(async (tx) => {
      for (const document of dto.documents) {
        const existing = await tx.admissionDocument.findFirst({
          where: { applicationId: application.id, name: document.name },
          select: { id: true },
        });

        if (existing) {
          await tx.admissionDocument.update({
            where: { id: existing.id },
            data: { fileUrl: document.fileUrl, uploadedAt: new Date() },
          });
        } else {
          await tx.admissionDocument.create({
            data: {
              applicationId: application.id,
              name: document.name,
              fileUrl: document.fileUrl,
            },
          });
        }
      }

      return tx.admissionApplication.findUniqueOrThrow({
        where: { id: application.id },
        include: applicationInclude,
      });
    });
  }

  async addDocument(id: string, dto: CreateApplicationDocumentDto) {
    await this.assertApplicantAccess(id, dto.accessToken);
    return this.prisma.admissionDocument.create({
      data: {
        applicationId: id,
        name: dto.name,
        fileUrl: dto.fileUrl,
      },
    });
  }

  async update(id: string, dto: UpdateApplicationDto) {
    await this.assertApplicantAccess(id, dto.accessToken);
    const { accessToken: _accessToken, ...data } = dto;
    return this.prisma.admissionApplication.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
      include: applicationInclude,
    });
  }

  async updateStatus(id: string, dto: UpdateApplicationStatusDto, reviewedById: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const reviewer = await this.prisma.user.findFirst({
      where: { id: reviewedById, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!reviewer) throw new ForbiddenException('Reviewer does not belong to this organization');

    if (dto.status === AdmissionStatus.APPROVED || dto.status === AdmissionStatus.ENROLLED) {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.admissionApplication.findFirst({
          where: { id, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (!existing) throw new NotFoundException('Application not found');

        const application = await tx.admissionApplication.update({
          where: { id: existing.id },
          data: {
            status: dto.status,
            decisionNotes: dto.decisionNotes,
            reviewedById,
            reviewedAt: new Date(),
          },
          include: { program: true, student: true },
        });
        const student = await this.createStudentFromApplication(tx, application);
        await notifyUser(tx, {
          organizationId: application.organizationId,
          userId: student.userId,
          type: 'ADMISSION',
          priority: 'HIGH',
          title: 'Admission approved',
          body: `Congratulations! Your application ${application.applicationCode} has been ${dto.status.toLowerCase().replaceAll('_', ' ')}.`,
          entityType: 'AdmissionApplication',
          entityId: application.id,
          link: '/admissions',
          dedupeKey: application.id,
        });
        return tx.admissionApplication.findUniqueOrThrow({ where: { id }, include: applicationInclude });
      });
    }

    const existing = await this.prisma.admissionApplication.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Application not found');

    return this.prisma.admissionApplication.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
        decisionNotes: dto.decisionNotes,
        reviewedById,
        reviewedAt: new Date(),
      },
      include: applicationInclude,
    });
  }

  private async assertApplicantAccess(id: string, accessToken: string) {
    const application = await this.prisma.admissionApplication.findUnique({
      where: { id },
      select: { accessToken: true, deletedAt: true },
    });
    if (!application || application.deletedAt) throw new NotFoundException('Application not found');
    if (application.accessToken !== accessToken) throw new ForbiddenException('Invalid application access token');
  }

  private newAccessToken() {
    return randomBytes(32).toString('hex');
  }

  private async sendApplicationCodeEmail(application: {
    id: string;
    applicantEmail: string;
    applicantName: string;
    applicationCode: string;
    program?: { code?: string | null; name?: string | null } | null;
  }) {
    const trackUrl = `${this.config.get<string>('frontendUrl') ?? 'http://localhost:5174'}/#apply`;
    const applicantName = this.escapeHtml(application.applicantName);
    const program = this.escapeHtml([application.program?.code, application.program?.name].filter(Boolean).join(' - ') || 'your selected program');
    const applicationCode = this.escapeHtml(application.applicationCode);

    try {
      await this.email.send({
        to: application.applicantEmail,
        subject: `Your UNISYS application code: ${application.applicationCode}`,
        idempotencyKey: `application-code-${application.id}`,
        text: `Hello ${application.applicantName}, your application code is ${application.applicationCode}. Use this code to track your admission status: ${trackUrl}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
            <h2 style="margin:0 0 12px">Your admission application was received</h2>
            <p>Hello ${applicantName},</p>
            <p>We received your application for <strong>${program}</strong>.</p>
            <p style="margin:24px 0;padding:18px;border-radius:12px;background:#eef2ff;color:#3730a3;font-size:22px;font-weight:800;letter-spacing:0.04em">${applicationCode}</p>
            <p>Use this application code to track your admission status and submit supporting documents.</p>
            <p><a href="${trackUrl}" style="display:inline-block;margin-top:8px;padding:10px 14px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700">Track application</a></p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(`Application code email failed for ${application.applicantEmail}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async notifyApplicantIfUserExists(application: {
    id: string;
    organizationId: string;
    applicantEmail: string;
    applicationCode: string;
  }) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          organizationId: application.organizationId,
          email: application.applicantEmail,
          deletedAt: null,
        },
        select: { id: true },
      });

      await notifyUser(this.prisma, {
        organizationId: application.organizationId,
        userId: user?.id,
        type: 'ADMISSION',
        priority: 'HIGH',
        title: 'Application submitted',
        body: `Your admission application was submitted. Your application code is ${application.applicationCode}.`,
        entityType: 'AdmissionApplication',
        entityId: application.id,
        link: '/admissions',
        dedupeKey: application.id,
      });
    } catch (error) {
      this.logger.warn(`Application submission notification failed for ${application.applicantEmail}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private async nextApplicationCode(organizationId: string) {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;
    const total = await this.prisma.admissionApplication.count({
      where: { organizationId, applicationCode: { startsWith: prefix } },
    });

    for (let offset = 1; offset <= 20; offset += 1) {
      const code = `${prefix}${String(total + offset).padStart(4, '0')}`;
      const exists = await this.prisma.admissionApplication.findUnique({ where: { applicationCode: code }, select: { id: true } });
      if (!exists) return code;
    }
    return `${prefix}${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private async createStudentFromApplication(
    tx: Prisma.TransactionClient,
    application: Prisma.AdmissionApplicationGetPayload<{ include: { program: true; student: true } }>,
  ) {
    if (application.student) return application.student;

    const [firstName, ...rest] = application.applicantName.trim().split(/\s+/);
    const lastName = rest.join(' ') || null;
    const password = await hashSecret(randomBytes(18).toString('base64url'), this.config.get<number>('bcryptRounds') ?? 12);
    const user = await tx.user.upsert({
      where: { email: application.applicantEmail },
      update: {
        organizationId: application.organizationId,
        role: UserRole.STUDENT,
        firstName,
        lastName,
        phone: application.phone,
      },
      create: {
        organizationId: application.organizationId,
        email: application.applicantEmail,
        password,
        role: UserRole.STUDENT,
        firstName,
        lastName,
        phone: application.phone,
      },
    });

    const existingStudent = await tx.student.findUnique({ where: { userId: user.id } });
    if (existingStudent) {
      return tx.student.update({
        where: { id: existingStudent.id },
        data: { applicationId: application.id, status: StudentStatus.ACTIVE, programId: application.programId },
      });
    }

    if (!application.program.departmentId) {
      throw new BadRequestException('Assign a department to this program before enrolling the applicant.');
    }

    return tx.student.create({
      data: {
        organizationId: application.organizationId,
        userId: user.id,
        studentId: await this.nextStudentId(tx, application.organizationId),
        departmentId: application.program.departmentId,
        programId: application.programId,
        applicationId: application.id,
        enrollmentDate: new Date(),
        status: StudentStatus.ACTIVE,
      },
    });
  }

  private async nextStudentId(tx: Prisma.TransactionClient, organizationId: string) {
    const year = new Date().getFullYear();
    const prefix = `STU-${year}-`;
    const total = await tx.student.count({ where: { organizationId, studentId: { startsWith: prefix } } });
    return `${prefix}${String(total + 1).padStart(4, '0')}`;
  }
}
