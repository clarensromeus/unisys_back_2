import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingCycle, OrganizationStatus, Prisma, SubscriptionStatus, UserRole } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { notifyUser } from '../../common/utils/notification.util';
import { hashSecret } from '../../common/utils/password.util';
import { CreateFacultyDto } from './dto/create-faculty.dto';
import { UpdateFacultyDto } from './dto/update-faculty.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { CreateAcademicProgressionDto } from './dto/create-academic-progression.dto';
import { CreateStudentHoldDto } from './dto/create-student-hold.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { CreateHostelDto } from './dto/create-hostel.dto';
import { AssignHostelRoomsDto } from './dto/assign-hostel-rooms.dto';
import { CreateHostelAllocationDto } from './dto/create-hostel-allocation.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreateScholarshipDto } from './dto/create-scholarship.dto';
import { CreateBookReservationDto } from './dto/create-book-reservation.dto';
import { UpdateBookReservationDto } from './dto/update-book-reservation.dto';
import { CreateEmployeeContractDto } from './dto/create-employee-contract.dto';
import { CreatePayrollCycleDto } from './dto/create-payroll-cycle.dto';
import { UpdatePayrollCycleDto } from './dto/update-payroll-cycle.dto';
import { CreatePayslipDto } from './dto/create-payslip.dto';
import { UpdatePayslipDto } from './dto/update-payslip.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { UpdateTenantSubscriptionDto } from './dto/update-tenant-subscription.dto';
import { UpsertTenantFeatureDto } from './dto/upsert-tenant-feature.dto';

type EnterpriseQuery = PaginationQueryDto;

function activeFilter(value?: string) {
  if (value === undefined) return undefined;
  const normalized = value.toUpperCase();
  if (['1', 'TRUE', 'YES', 'ACTIVE', 'READ', 'PUBLISHED'].includes(normalized)) return true;
  if (['0', 'FALSE', 'NO', 'ARCHIVED', 'INACTIVE', 'UNREAD', 'DRAFT'].includes(normalized)) return false;
  return undefined;
}

function slugFromName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function normalizedCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/^-|-$/g, '');
}

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async org() {
    return defaultOrganizationId(this.prisma);
  }

  private planCode(value: string) {
    return normalizedCode(value).replaceAll('-', '_');
  }

  private async ensureDefaultPlan() {
    return this.prisma.subscriptionPlan.upsert({
      where: { code: 'ENTERPRISE_MANUAL' },
      update: {},
      create: {
        code: 'ENTERPRISE_MANUAL',
        name: 'Enterprise Manual',
        description: 'Default manually managed SaaS plan for tenant onboarding.',
        status: OrganizationStatus.ACTIVE,
        billingCycle: BillingCycle.MANUAL,
        price: 0,
        currency: 'HTG',
        maxStudents: 10000,
        maxStaff: 1000,
        maxCampuses: 10,
        maxStorageGb: 500,
        features: {
          admissions: true,
          academics: true,
          finance: true,
          library: true,
          hr: true,
          accommodation: true,
          multilingual: true,
        },
      },
    });
  }

  private planData(dto: CreateSubscriptionPlanDto | UpdateSubscriptionPlanDto) {
    return {
      code: dto.code ? this.planCode(dto.code) : undefined,
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      status: dto.status,
      billingCycle: dto.billingCycle,
      price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
      currency: dto.currency?.trim().toUpperCase(),
      maxStudents: dto.maxStudents,
      maxStaff: dto.maxStaff,
      maxCampuses: dto.maxCampuses,
      maxStorageGb: dto.maxStorageGb,
      features: dto.features === undefined ? undefined : dto.features as Prisma.InputJsonValue,
    };
  }

  async subscriptionPlans(query: EnterpriseQuery) {
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.SubscriptionPlanWhereInput = {
      deletedAt: null,
      status: query.status as never,
      billingCycle: query.type as never,
      OR: query.search ? [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { subscriptions: true } } },
        orderBy: [{ status: 'asc' }, { price: 'asc' }],
      }),
      this.prisma.subscriptionPlan.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  createSubscriptionPlan(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        ...this.planData(dto),
        code: this.planCode(dto.code),
        name: dto.name.trim(),
        status: dto.status ?? OrganizationStatus.ACTIVE,
        billingCycle: dto.billingCycle ?? BillingCycle.MANUAL,
        currency: dto.currency?.trim().toUpperCase() || 'HTG',
      },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  updateSubscriptionPlan(id: string, dto: UpdateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: this.planData(dto),
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async tenantSubscriptions(query: EnterpriseQuery) {
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.TenantSubscriptionWhereInput = {
      status: query.status as never,
      plan: query.name ? { name: { contains: query.name, mode: 'insensitive' } } : undefined,
      organization: query.search ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
        ],
      } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.tenantSubscription.findMany({
        where,
        skip,
        take,
        include: { organization: true, plan: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.tenantSubscription.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async organizationUsage(organizationId: string) {
    const [organization, usersCount, studentsCount, teachersCount, staffCount, coursesCount] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        include: { subscription: { include: { plan: true } }, featureFlags: true },
      }),
      this.prisma.user.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.student.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.teacher.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.staff.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.course.count({ where: { organizationId, deletedAt: null } }),
    ]);

    const usage = { usersCount, studentsCount, teachersCount, staffCount, coursesCount, storageUsedMb: 0 };
    const snapshot = await this.prisma.tenantUsageSnapshot.create({
      data: { organizationId, ...usage },
    });
    const plan = organization.subscription?.plan;
    const limits = {
      maxStudents: plan?.maxStudents ?? null,
      maxStaff: plan?.maxStaff ?? null,
      maxCampuses: plan?.maxCampuses ?? null,
      maxStorageGb: plan?.maxStorageGb ?? null,
    };
    return { organization, usage, limits, snapshot };
  }

  async updateOrganizationSubscription(organizationId: string, dto: UpdateTenantSubscriptionDto) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: dto.planId, deletedAt: null, status: OrganizationStatus.ACTIVE },
    });
    if (!plan) throw new BadRequestException('Selected subscription plan is not active');

    return this.prisma.tenantSubscription.upsert({
      where: { organizationId },
      update: {
        planId: dto.planId,
        status: dto.status,
        billingCycle: dto.billingCycle ?? plan.billingCycle,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
        renewsAt: dto.renewsAt ? new Date(dto.renewsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        canceledAt: dto.canceledAt ? new Date(dto.canceledAt) : undefined,
        notes: dto.notes?.trim(),
      },
      create: {
        organizationId,
        planId: dto.planId,
        status: dto.status ?? SubscriptionStatus.TRIALING,
        billingCycle: dto.billingCycle ?? plan.billingCycle,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
        renewsAt: dto.renewsAt ? new Date(dto.renewsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        canceledAt: dto.canceledAt ? new Date(dto.canceledAt) : undefined,
        notes: dto.notes?.trim(),
      },
      include: { organization: true, plan: true },
    });
  }

  tenantFeatures(organizationId: string) {
    return this.prisma.tenantFeatureFlag.findMany({
      where: { organizationId },
      orderBy: { key: 'asc' },
    });
  }

  upsertTenantFeature(organizationId: string, dto: UpsertTenantFeatureDto) {
    return this.prisma.tenantFeatureFlag.upsert({
      where: { organizationId_key: { organizationId, key: normalizedCode(dto.key).toLowerCase() } },
      update: { enabled: dto.enabled, config: dto.config as Prisma.InputJsonValue | undefined },
      create: {
        organizationId,
        key: normalizedCode(dto.key).toLowerCase(),
        enabled: dto.enabled,
        config: dto.config as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async organizations(query: EnterpriseQuery) {
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.OrganizationWhereInput = {
      status: query.status as never,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      slug: query.slug ? { equals: query.slug, mode: 'insensitive' } : undefined,
      OR: query.search ? [{ name: { contains: query.search, mode: 'insensitive' } }, { slug: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        include: {
          subscription: { include: { plan: true } },
          featureFlags: true,
          _count: { select: { users: true, students: true, teachers: true, courses: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createOrganization(dto: CreateOrganizationDto) {
    const plan = dto.planId
      ? await this.prisma.subscriptionPlan.findFirst({ where: { id: dto.planId, deletedAt: null, status: OrganizationStatus.ACTIVE } })
      : await this.ensureDefaultPlan();
    if (!plan) throw new BadRequestException('Selected subscription plan is not active');

    const adminEmail = dto.adminEmail?.trim().toLowerCase();
    if (adminEmail) {
      const existingAdmin = await this.prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
      if (existingAdmin) throw new BadRequestException('Tenant admin email is already in use');
    }

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.name.trim(),
          displayName: dto.displayName?.trim(),
          slug: slugFromName(dto.slug || dto.name),
          status: dto.status ?? OrganizationStatus.ACTIVE,
          timezone: dto.timezone?.trim() || 'UTC',
          contactEmail: dto.contactEmail?.trim().toLowerCase(),
          website: dto.website?.trim(),
          logoUrl: dto.logoUrl?.trim(),
          primaryColor: dto.primaryColor?.trim(),
          customDomain: dto.customDomain?.trim().toLowerCase(),
          subscription: {
            create: {
              planId: plan.id,
              status: SubscriptionStatus.TRIALING,
              billingCycle: plan.billingCycle,
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          },
          featureFlags: {
            create: [
              { key: 'admissions', enabled: true },
              { key: 'academics', enabled: true },
              { key: 'finance', enabled: true },
              { key: 'library', enabled: true },
              { key: 'hr', enabled: true },
              { key: 'accommodation', enabled: true },
              { key: 'multilingual', enabled: true },
            ],
          },
        },
      });

      if (adminEmail) {
        const permission = await tx.permission.upsert({
          where: { organizationId_action_subject: { organizationId: organization.id, action: 'manage', subject: 'all' } },
          update: {},
          create: { organizationId: organization.id, action: 'manage', subject: 'all', description: 'Manage tenant ERP workspace' },
        });
        const role = await tx.role.upsert({
          where: { organizationId_name: { organizationId: organization.id, name: 'TENANT_ADMIN' } },
          update: { systemRole: UserRole.TENANT_ADMIN },
          create: { organizationId: organization.id, name: 'TENANT_ADMIN', systemRole: UserRole.TENANT_ADMIN },
        });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
        const admin = await tx.user.create({
          data: {
            organizationId: organization.id,
            email: adminEmail,
            password: await hashSecret(dto.adminPassword || 'Password123!', this.config.get<number>('bcryptRounds') ?? 12),
            role: UserRole.TENANT_ADMIN,
            firstName: dto.adminFirstName?.trim() || 'Tenant',
            lastName: dto.adminLastName?.trim() || 'Admin',
          },
        });
        await tx.userRoleAssignment.create({
          data: { userId: admin.id, roleId: role.id, scopeType: 'ORGANIZATION', scopeId: organization.id },
        });
      }

      return tx.organization.findUniqueOrThrow({
        where: { id: organization.id },
        include: {
          subscription: { include: { plan: true } },
          featureFlags: true,
          _count: { select: { users: true, students: true, teachers: true, courses: true } },
        },
      });
    });
  }

  async faculties(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.FacultyWhereInput = {
      organizationId,
      deletedAt: null,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      OR: query.search ? [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.faculty.findMany({
        where,
        skip,
        take,
        include: {
          head: { include: { user: { select: { email: true, firstName: true, lastName: true, role: true } }, teacher: true, staff: true } },
          _count: { select: { departments: true, programs: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.faculty.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createFaculty(dto: CreateFacultyDto) {
    const organizationId = await this.org();
    return this.prisma.faculty.create({
      data: {
        organizationId,
        code: normalizedCode(dto.code),
        name: dto.name.trim(),
      },
      include: { head: { include: { user: { select: { email: true, firstName: true, lastName: true, role: true } }, teacher: true, staff: true } }, _count: { select: { departments: true, programs: true } } },
    });
  }

  async updateFaculty(id: string, dto: UpdateFacultyDto) {
    const organizationId = await this.org();
    if (dto.headId) {
      const [employee, existingHeadship] = await Promise.all([
        this.prisma.employee.findFirst({
          where: { id: dto.headId, organizationId, deletedAt: null },
          include: { user: { select: { email: true, firstName: true, lastName: true } } },
        }),
        this.prisma.faculty.findFirst({
          where: { organizationId, headId: dto.headId, id: { not: id } },
          select: { name: true },
        }),
      ]);

      if (!employee) throw new BadRequestException('Selected faculty head does not exist');
      if (existingHeadship) {
        const employeeName = [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' ') || employee.user.email;
        throw new BadRequestException(`${employeeName} is already the head of ${existingHeadship.name}`);
      }
    }

    return this.prisma.faculty.update({
      where: { id },
      data: {
        code: dto.code ? normalizedCode(dto.code) : undefined,
        name: dto.name ? dto.name.trim() : undefined,
        headId: dto.headId,
      },
      include: {
        head: { include: { user: { select: { email: true, firstName: true, lastName: true, role: true } }, teacher: true, staff: true } },
        _count: { select: { departments: true, programs: true } },
      },
    });
  }

  async employees(query: EnterpriseQuery & { employeeType?: string }) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      deletedAt: null,
      employeeType: query.employeeType as never,
      OR: query.search ? [
        { employeeNo: { contains: query.search, mode: 'insensitive' } },
        { designation: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          teacher: { include: { department: true } },
          staff: true,
          headedDepartment: true,
          headedFaculty: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const organizationId = await this.org();
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) throw new BadRequestException('A user with this email already exists');

    const employeeNo = dto.employeeNo ? normalizedCode(dto.employeeNo) : undefined;
    if (employeeNo) {
      const existingEmployeeNo = await this.prisma.employee.findFirst({
        where: { organizationId, employeeNo, deletedAt: null },
        select: { id: true },
      });
      if (existingEmployeeNo) throw new BadRequestException('Employee number is already in use');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId,
          email,
          role: dto.accountRole || (dto.employeeType === 'ACADEMIC' ? UserRole.TEACHER : UserRole.ADMIN),
          firstName: dto.firstName?.trim() || undefined,
          lastName: dto.lastName?.trim() || undefined,
          password: await hashSecret(dto.password || 'Password123!', this.config.get<number>('bcryptRounds') ?? 12),
        },
        select: { id: true },
      });

      return tx.employee.create({
        data: {
          organizationId,
          userId: user.id,
          employeeNo,
          employeeType: dto.employeeType,
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          teacher: { include: { department: true } },
          staff: true,
          headedDepartment: true,
          headedFaculty: true,
        },
      });
    });
  }

  async programs(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.ProgramWhereInput = {
      organizationId,
      deletedAt: null,
      level: query.level as never,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      departmentId: query.departmentId,
      facultyId: query.facultyId,
      department: query.departmentName ? { name: { equals: query.departmentName, mode: 'insensitive' } } : undefined,
      OR: query.search ? [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.program.findMany({ where, skip, take, include: { faculty: true, department: true, _count: { select: { students: true, courses: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.program.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createProgram(dto: CreateProgramDto) {
    const organizationId = await this.org();
    if (dto.departmentId) {
      await this.prisma.department.findFirstOrThrow({
        where: {
          id: dto.departmentId,
          organizationId,
          facultyId: dto.facultyId,
          deletedAt: null,
        },
        select: { id: true },
      });
    }
    return this.prisma.program.create({
      data: {
        organizationId,
        facultyId: dto.facultyId,
        departmentId: dto.departmentId,
        code: normalizedCode(dto.code),
        name: dto.name.trim(),
        level: dto.level,
        durationTerms: dto.durationTerms,
        totalCredits: dto.totalCredits,
      },
      include: { faculty: true, department: true, _count: { select: { students: true, courses: true } } },
    });
  }

  async updateProgram(id: string, dto: UpdateProgramDto) {
    const data: Prisma.ProgramUpdateInput = {
      faculty: dto.facultyId ? { connect: { id: dto.facultyId } } : undefined,
      department: dto.departmentId ? { connect: { id: dto.departmentId } } : undefined,
      code: dto.code ? normalizedCode(dto.code) : undefined,
      name: dto.name ? dto.name.trim() : undefined,
      level: dto.level,
      durationTerms: dto.durationTerms,
      totalCredits: dto.totalCredits,
    };

    return this.prisma.program.update({
      where: { id },
      data,
      include: { faculty: true, department: true, _count: { select: { students: true, courses: true } } },
    });
  }

  async academicYears(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.AcademicYearWhereInput = {
      organizationId,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      isActive: activeFilter(query.isActive ?? query.status),
    };
    const [items, total] = await Promise.all([
      this.prisma.academicYear.findMany({ where, skip, take, include: { _count: { select: { semesters: true } } }, orderBy: { startsOn: 'desc' } }),
      this.prisma.academicYear.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async semesters(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.SemesterWhereInput = {
      organizationId,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      term: query.term as never,
      isActive: activeFilter(query.isActive ?? query.status),
      academicYear: query.academicYearName ? { name: { equals: query.academicYearName, mode: 'insensitive' } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.semester.findMany({ where, skip, take, include: { academicYear: true, _count: { select: { offerings: true, invoices: true } } }, orderBy: { startsOn: 'desc' } }),
      this.prisma.semester.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createSemester(dto: CreateSemesterDto) {
    const organizationId = await this.org();
    await this.prisma.academicYear.findFirstOrThrow({
      where: { id: dto.academicYearId, organizationId },
      select: { id: true },
    });

    return this.prisma.semester.create({
      data: {
        organizationId,
        academicYearId: dto.academicYearId,
        name: dto.name.trim(),
        term: dto.term,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        addDropStartsOn: dto.addDropStartsOn ? new Date(dto.addDropStartsOn) : undefined,
        addDropEndsOn: dto.addDropEndsOn ? new Date(dto.addDropEndsOn) : undefined,
        isActive: dto.isActive ?? false,
      },
      include: { academicYear: true, _count: { select: { offerings: true, invoices: true } } },
    });
  }

  async admissions(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.AdmissionApplicationWhereInput = {
      organizationId,
      deletedAt: null,
      status: query.status as never,
      applicantName: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      programId: query.programId,
      program: query.programName ? { name: { equals: query.programName, mode: 'insensitive' } } : undefined,
      OR: query.search ? [{ applicantName: { contains: query.search, mode: 'insensitive' } }, { applicantEmail: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.admissionApplication.findMany({
        where,
        skip,
        take,
        include: {
          program: true,
          student: true,
          documents: { orderBy: { uploadedAt: 'desc' } },
          reviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.admissionApplication.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async offerings(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.CourseOfferingWhereInput = {
      organizationId,
      deletedAt: null,
      section: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      courseId: query.courseId,
      semesterId: query.semesterId,
      instructorId: query.teacherId,
      course: query.courseName ? { name: { equals: query.courseName, mode: 'insensitive' } } : undefined,
      semester: query.semesterName ? { name: { equals: query.semesterName, mode: 'insensitive' } } : undefined,
      instructor: query.instructorName ? { user: { email: { contains: query.instructorName, mode: 'insensitive' } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.courseOffering.findMany({ where, skip, take, include: { course: true, semester: true, instructor: { include: { user: { select: { email: true } } } }, _count: { select: { registrations: true, timetables: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.courseOffering.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createOffering(dto: CreateOfferingDto) {
    const organizationId = await this.org();
    let instructorId = dto.instructorId;

    if (!instructorId) {
      const course = await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { teacherId: true } });
      instructorId = course?.teacherId || '';
    }

    if (!instructorId) {
      throw new Error('Instructor is required for course offering');
    }

    return this.prisma.courseOffering.create({
      data: {
        organizationId,
        courseId: dto.courseId,
        semesterId: dto.semesterId,
        instructorId,
        section: dto.section,
        capacity: dto.capacity,
        waitlistCapacity: dto.waitlistCapacity || 0,
      },
      include: { course: true, semester: true, instructor: { include: { user: { select: { email: true } } } } },
    });
  }

  async updateOffering(id: string, dto: UpdateOfferingDto) {
    const data: Prisma.CourseOfferingUpdateInput = {
      course: dto.courseId ? { connect: { id: dto.courseId } } : undefined,
      semester: dto.semesterId ? { connect: { id: dto.semesterId } } : undefined,
      instructor: dto.instructorId ? { connect: { id: dto.instructorId } } : undefined,
      section: dto.section,
      capacity: dto.capacity,
      waitlistCapacity: dto.waitlistCapacity,
    };

    return this.prisma.courseOffering.update({
      where: { id },
      data,
      include: { course: true, semester: true, instructor: { include: { user: { select: { email: true } } } } },
    });
  }

  async registrations(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.CourseRegistrationWhereInput = {
      organizationId,
      status: query.status as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
      courseId: query.courseId,
      courseOffering: query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.courseRegistration.findMany({
        where,
        skip,
        take,
        include: {
          student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true, department: true } },
          courseOffering: { include: { course: true, semester: true } },
        },
        orderBy: { registeredAt: 'desc' },
      }),
      this.prisma.courseRegistration.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createRegistration(dto: CreateRegistrationDto) {
    const organizationId = await this.org();
    const offering = await this.prisma.courseOffering.findUniqueOrThrow({
      where: { id: dto.courseOfferingId },
      include: { course: true, semester: true },
    });
    const registration = await this.prisma.courseRegistration.create({
      data: {
        ...dto,
        courseId: offering.courseId,
        organizationId,
      },
      include: { student: { include: { user: { select: { id: true } } } }, courseOffering: { include: { course: true, semester: true } } },
    });

    if (registration.status === 'ENROLLED') {
      await notifyUser(this.prisma, {
        organizationId,
        userId: registration.student.user.id,
        type: 'REGISTRATION',
        title: 'Course registration confirmed',
        body: `You have successfully enrolled in ${offering.course.code} - ${offering.course.name}.`,
        entityType: 'CourseRegistration',
        entityId: registration.id,
        link: '/registrations',
        dedupeKey: registration.id,
      });
    }

    return registration;
  }

  async updateRegistration(id: string, dto: UpdateRegistrationDto) {
    const registration = await this.prisma.courseRegistration.update({
      where: { id },
      data: dto,
      include: { student: { include: { user: { select: { id: true } } } }, courseOffering: { include: { course: true, semester: true } } },
    });
    if (dto.status) {
      await notifyUser(this.prisma, {
        organizationId: registration.organizationId,
        userId: registration.student.user.id,
        type: 'REGISTRATION',
        priority: dto.status === 'DROPPED' || dto.status === 'FAILED' ? 'HIGH' : 'NORMAL',
        title: `Course registration ${dto.status.toLowerCase().replaceAll('_', ' ')}`,
        body: `Your registration for ${registration.courseOffering.course.code} - ${registration.courseOffering.course.name} is now ${dto.status.toLowerCase().replaceAll('_', ' ')}.`,
        entityType: 'CourseRegistration',
        entityId: registration.id,
        link: '/registrations',
      });
    }
    return registration;
  }

  async invoices(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      status: query.status as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
      semester: query.semesterName ? { name: { equals: query.semesterName, mode: 'insensitive' } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, skip, take, include: { student: true, semester: true, _count: { select: { items: true, payments: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const organizationId = await this.org();
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId, deletedAt: null },
      include: { user: { select: { id: true } } },
    });
    if (!student) throw new BadRequestException('Selected student does not exist');
    if (dto.semesterId) {
      await this.prisma.semester.findFirstOrThrow({ where: { id: dto.semesterId, organizationId }, select: { id: true } });
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        semesterId: dto.semesterId,
        invoiceNo: dto.invoiceNo?.trim() || await this.nextInvoiceNo(organizationId),
        status: dto.status ?? 'ISSUED',
        subtotal: dto.subtotal ?? dto.total,
        discountTotal: dto.discountTotal ?? 0,
        total: dto.total,
        dueDate: new Date(dto.dueDate),
      },
      include: { student: true, semester: true, _count: { select: { items: true, payments: true } } },
    });

    await notifyUser(this.prisma, {
      organizationId,
      userId: student.user.id,
      type: 'FINANCE',
      priority: 'HIGH',
      title: 'New invoice generated',
      body: `You have a new invoice of $${Number(invoice.total).toLocaleString()} due on ${invoice.dueDate.toLocaleDateString()}.`,
      entityType: 'Invoice',
      entityId: invoice.id,
      link: '/invoices',
      dedupeKey: invoice.id,
    });

    return invoice;
  }

  async payments(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.PaymentWhereInput = {
      organizationId,
      status: query.status as never,
      method: query.method as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({ where, skip, take, include: { student: true, invoice: true }, orderBy: { paidAt: 'desc' } }),
      this.prisma.payment.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createPayment(dto: CreatePaymentDto) {
    const organizationId = await this.org();
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, organizationId, deletedAt: null },
      include: { student: { include: { user: { select: { id: true } } } } },
    });
    if (!invoice) throw new BadRequestException('Selected invoice does not exist');

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId,
          invoiceId: invoice.id,
          studentId: invoice.studentId,
          paymentNo: dto.paymentNo?.trim() || await this.nextPaymentNo(organizationId),
          amount: dto.amount,
          status: dto.status || 'PAID',
          method: dto.method,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          reference: dto.reference?.trim() || undefined,
        },
        include: { student: true, invoice: true },
      });

      await tx.transaction.create({
        data: {
          organizationId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          paymentId: created.id,
          amount: dto.amount,
          status: dto.status || 'PAID',
          type: 'TUITION',
        },
      });

      const paymentTotals = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: { in: ['PAID', 'PARTIAL'] } },
        _sum: { amount: true },
      });
      const paid = Number(paymentTotals._sum.amount || 0);
      const total = Number(invoice.total || 0);
      if (paid >= total) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
      } else if (paid > 0) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PARTIALLY_PAID' } });
      }

      return created;
    });

    if (payment.status === 'PAID' || payment.status === 'PARTIAL') {
      await notifyUser(this.prisma, {
        organizationId,
        userId: invoice.student.user.id,
        type: 'FINANCE',
        title: 'Payment recorded',
        body: `Your payment of $${Number(payment.amount).toLocaleString()} has been recorded for invoice ${invoice.invoiceNo}.`,
        entityType: 'Payment',
        entityId: payment.id,
        link: '/payments',
        dedupeKey: payment.id,
      });
    }

    return payment;
  }

  async scholarships(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.ScholarshipWhereInput = {
      organizationId,
      deletedAt: null,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      OR: query.search ? [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.scholarship.findMany({ where, skip, take, include: { _count: { select: { students: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.scholarship.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createScholarship(dto: CreateScholarshipDto) {
    const organizationId = await this.org();
    const code = normalizedCode(dto.code);
    if (!dto.discountAmount && !dto.discountPercent) {
      throw new BadRequestException('Provide either a discount amount or a discount percent');
    }

    if (dto.studentIds?.length) {
      const total = await this.prisma.student.count({
        where: { id: { in: dto.studentIds }, organizationId, deletedAt: null },
      });
      if (total !== dto.studentIds.length) throw new BadRequestException('One or more selected students do not exist');
    }

    return this.prisma.scholarship.create({
      data: {
        organizationId,
        code,
        name: dto.name.trim(),
        discountAmount: dto.discountAmount,
        discountPercent: dto.discountPercent,
        students: dto.studentIds?.length ? {
          create: dto.studentIds.map((studentId) => ({
            studentId,
            startsOn: dto.startsOn ? new Date(dto.startsOn) : new Date(),
          })),
        } : undefined,
      },
      include: { _count: { select: { students: true } } },
    });
  }

  async feeStructures(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.FeeStructureWhereInput = {
      organizationId,
      deletedAt: null,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      feeType: (query.feeType || query.type) as never,
      program: query.programName ? { OR: [{ code: { equals: query.programName, mode: 'insensitive' } }, { name: { equals: query.programName, mode: 'insensitive' } }] } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.feeStructure.findMany({ where, skip, take, include: { program: true, _count: { select: { invoiceItems: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.feeStructure.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createFeeStructure(dto: CreateFeeStructureDto) {
    const organizationId = await this.org();
    if (dto.programId) {
      await this.prisma.program.findFirstOrThrow({ where: { id: dto.programId, organizationId, deletedAt: null }, select: { id: true } });
    }

    return this.prisma.feeStructure.create({
      data: {
        organizationId,
        programId: dto.programId,
        feeType: dto.feeType,
        name: dto.name.trim(),
        amount: dto.amount,
        currency: dto.currency?.trim().toUpperCase() || 'HTG',
        isRecurring: dto.isRecurring ?? false,
      },
      include: { program: true, _count: { select: { invoiceItems: true } } },
    });
  }

  async studentHolds(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.StudentHoldWhereInput = {
      organizationId,
      status: query.status as never,
      type: query.type as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.studentHold.findMany({ where, skip, take, include: { student: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.studentHold.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createStudentHold(dto: CreateStudentHoldDto) {
    const organizationId = await this.org();
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, organizationId, deletedAt: null },
      include: { user: { select: { id: true } } },
    });

    if (!student) throw new BadRequestException('Selected student does not exist');

    const hold = await this.prisma.studentHold.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        type: dto.type,
        status: dto.status,
        reason: dto.reason.trim(),
        releasedAt: dto.releasedAt ? new Date(dto.releasedAt) : undefined,
      },
      include: { student: true },
    });

    if (dto.type === 'FINANCIAL') {
      await this.prisma.student.update({
        where: { id: dto.studentId },
        data: { financialHold: dto.status === 'ACTIVE' },
      });
    }

    if (hold.status === 'ACTIVE') {
      await notifyUser(this.prisma, {
        organizationId,
        userId: student.user.id,
        type: dto.type === 'FINANCIAL' ? 'FINANCE' : 'ACADEMIC',
        priority: 'URGENT',
        title: `${dto.type.toLowerCase().replaceAll('_', ' ')} hold placed`,
        body: `A ${dto.type.toLowerCase().replaceAll('_', ' ')} hold has been placed on your account. Reason: ${hold.reason}`,
        entityType: 'StudentHold',
        entityId: hold.id,
        link: '/financial-holds',
        dedupeKey: hold.id,
      });
    }

    return hold;
  }

  private async nextInvoiceNo(organizationId: string) {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const total = await this.prisma.invoice.count({ where: { organizationId, invoiceNo: { startsWith: prefix } } });
    return `${prefix}${String(total + 1).padStart(4, '0')}`;
  }

  private async nextPaymentNo(organizationId: string) {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const total = await this.prisma.payment.count({ where: { organizationId, paymentNo: { startsWith: prefix } } });
    return `${prefix}${String(total + 1).padStart(5, '0')}`;
  }

  async academicProgression(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.AcademicProgressionWhereInput = {
      organizationId,
      standing: query.standing as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.academicProgression.findMany({ where, skip, take, include: { student: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.academicProgression.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createAcademicProgression(dto: CreateAcademicProgressionDto) {
    const organizationId = await this.org();
    const [student, semester] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.semester.findFirst({
        where: { id: dto.semesterId, organizationId },
        select: { id: true },
      }),
    ]);

    if (!student) throw new BadRequestException('Selected student does not exist');
    if (!semester) throw new BadRequestException('Selected semester does not exist');

    return this.prisma.academicProgression.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        semesterId: dto.semesterId,
        attemptedCredits: dto.attemptedCredits,
        earnedCredits: dto.earnedCredits,
        termGpa: dto.termGpa,
        cumulativeGpa: dto.cumulativeGpa,
        standing: dto.standing,
        notes: dto.notes?.trim() || undefined,
      },
      include: { student: true },
    });
  }

  async gradeScales(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.GradeScaleWhereInput = { organizationId, letter: query.letter || query.status || undefined };
    const [items, total] = await Promise.all([
      this.prisma.gradeScale.findMany({ where, skip, take, orderBy: { minScore: 'desc' } }),
      this.prisma.gradeScale.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async timeSlots(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.TimeSlotWhereInput = {
      organizationId,
      dayOfWeek: query.dayOfWeek as never,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      OR: query.search ? [
        { name: { contains: query.search, mode: 'insensitive' } },
        { startsAt: { contains: query.search, mode: 'insensitive' } },
        { endsAt: { contains: query.search, mode: 'insensitive' } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.timeSlot.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { timetables: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
      }),
      this.prisma.timeSlot.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createTimeSlot(dto: CreateTimeSlotDto) {
    const organizationId = await this.org();
    if (dto.startsAt >= dto.endsAt) {
      throw new BadRequestException('Time slot start time must be before end time');
    }

    return this.prisma.timeSlot.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        dayOfWeek: dto.dayOfWeek,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      },
      include: { _count: { select: { timetables: true } } },
    });
  }

  async timetable(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.TimetableWhereInput = {
      organizationId,
      room: query.roomCode ? { code: { equals: query.roomCode, mode: 'insensitive' } } : undefined,
      courseOffering: query.courseName ? { course: { name: { equals: query.courseName, mode: 'insensitive' } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.timetable.findMany({ where, skip, take, include: { room: true, timeSlot: true, courseOffering: { include: { course: true, instructor: { include: { user: { select: { email: true } } } } } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.timetable.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createTimetable(dto: CreateTimetableDto) {
    const organizationId = await this.org();
    const [courseOffering, room, timeSlot] = await Promise.all([
      this.prisma.courseOffering.findFirst({
        where: { id: dto.courseOfferingId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.room.findFirst({
        where: { id: dto.roomId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.timeSlot.findFirst({
        where: { id: dto.timeSlotId, organizationId },
        select: { id: true },
      }),
    ]);

    if (!courseOffering) throw new BadRequestException('Selected course offering does not exist');
    if (!room) throw new BadRequestException('Selected room does not exist');
    if (!timeSlot) throw new BadRequestException('Selected time slot does not exist');

    const conflict = await this.prisma.timetable.findFirst({
      where: {
        organizationId,
        timeSlotId: dto.timeSlotId,
        OR: [
          { roomId: dto.roomId },
          { courseOfferingId: dto.courseOfferingId },
        ],
      },
      include: { room: true, courseOffering: { include: { course: true } } },
    });

    if (conflict?.roomId === dto.roomId) {
      throw new BadRequestException(`Room ${conflict.room.code} is already booked for this time slot`);
    }
    if (conflict?.courseOfferingId === dto.courseOfferingId) {
      throw new BadRequestException(`${conflict.courseOffering.course.code} is already scheduled for this time slot`);
    }

    return this.prisma.timetable.create({
      data: {
        organizationId,
        courseOfferingId: dto.courseOfferingId,
        roomId: dto.roomId,
        timeSlotId: dto.timeSlotId,
        startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
      },
      include: { room: true, timeSlot: true, courseOffering: { include: { course: true, instructor: { include: { user: { select: { email: true } } } } } } },
    });
  }

  async rooms(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.RoomWhereInput = {
      organizationId,
      deletedAt: null,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      type: query.type as never,
    };
    const [items, total] = await Promise.all([
      this.prisma.room.findMany({ where, skip, take, include: { _count: { select: { timetables: true, hostelRooms: true } } }, orderBy: { code: 'asc' } }),
      this.prisma.room.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createRoom(dto: CreateRoomDto) {
    const organizationId = await this.org();
    return this.prisma.room.create({
      data: {
        organizationId,
        code: normalizedCode(dto.code),
        name: dto.name.trim(),
        type: dto.type,
        capacity: Number(dto.capacity),
        bedCount: dto.bedCount ? Number(dto.bedCount) : undefined,
        building: dto.building?.trim() || undefined,
      },
      include: { _count: { select: { timetables: true, hostelRooms: true } } },
    });
  }

  async hostels(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.HostelWhereInput = {
      organizationId,
      deletedAt: null,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      gender: query.type as never,
      OR: query.search ? [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.hostel.findMany({
        where,
        skip,
        take,
        include: {
          warden: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
          rooms: true,
          _count: { select: { rooms: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.hostel.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createHostel(dto: CreateHostelDto) {
    const organizationId = await this.org();
    if (dto.wardenId) {
      await this.prisma.employee.findFirstOrThrow({
        where: { id: dto.wardenId, organizationId, deletedAt: null },
        select: { id: true },
      });
    }

    return this.prisma.hostel.create({
      data: {
        organizationId,
        code: normalizedCode(dto.code),
        name: dto.name.trim(),
        address: dto.address?.trim() || undefined,
        location: dto.location?.trim() || undefined,
        amenities: dto.amenities || [],
        gender: dto.gender || 'MIXED',
        capacityLimit: dto.capacityLimit,
        wardenId: dto.wardenId,
      },
      include: {
        warden: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        rooms: true,
        _count: { select: { rooms: true } },
      },
    });
  }

  async assignHostelRooms(id: string, dto: AssignHostelRoomsDto) {
    const organizationId = await this.org();
    const hostel = await this.prisma.hostel.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    const rooms = await this.prisma.room.findMany({
      where: { id: { in: dto.roomIds }, organizationId, type: 'HOSTEL', deletedAt: null },
      select: { id: true, code: true, capacity: true, bedCount: true },
    });
    if (rooms.length !== dto.roomIds.length) throw new BadRequestException('One or more selected hostel rooms do not exist');

    const conflictingRoom = await this.prisma.hostelRoom.findFirst({
      where: {
        organizationId,
        roomId: { in: dto.roomIds },
        hostelId: { not: hostel.id },
        deletedAt: null,
      },
      include: { hostel: true },
    });
    if (conflictingRoom) {
      throw new BadRequestException(`Room ${conflictingRoom.roomNumber} is already assigned to ${conflictingRoom.hostel.name}`);
    }

    await this.prisma.$transaction(rooms.map((room) => {
      const bedCapacity = room.bedCount ?? room.capacity;
      return this.prisma.hostelRoom.upsert({
        where: { hostelId_roomNumber: { hostelId: hostel.id, roomNumber: room.code } },
        update: {
          roomId: room.id,
          roomType: dto.roomType || 'SHARED',
          capacity: bedCapacity,
          monthlyRate: dto.monthlyRate ?? 0,
        },
        create: {
          organizationId,
          hostelId: hostel.id,
          roomId: room.id,
          roomNumber: room.code,
          roomType: dto.roomType || 'SHARED',
          capacity: bedCapacity,
          monthlyRate: dto.monthlyRate ?? 0,
        },
      });
    }));

    return this.prisma.hostel.findUniqueOrThrow({
      where: { id },
      include: {
        warden: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        rooms: { include: { room: true } },
        _count: { select: { rooms: true } },
      },
    });
  }

  async hostelRooms(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.HostelRoomWhereInput = {
      organizationId,
      deletedAt: null,
      hostelId: query.hostelId,
      hostel: query.hostelName ? { name: { equals: query.hostelName, mode: 'insensitive' } } : undefined,
      roomNumber: query.roomCode ? { equals: query.roomCode, mode: 'insensitive' } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.hostelRoom.findMany({ where, skip, take, include: { hostel: true, room: true, _count: { select: { allocations: true } } }, orderBy: { roomNumber: 'asc' } }),
      this.prisma.hostelRoom.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async hostelAllocations(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.HostelAllocationWhereInput = {
      organizationId,
      status: query.status as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
      hostelRoom: query.hostelName || query.roomCode ? {
        hostel: query.hostelName ? { name: { equals: query.hostelName, mode: 'insensitive' } } : undefined,
        roomNumber: query.roomCode ? { equals: query.roomCode, mode: 'insensitive' } : undefined,
      } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.hostelAllocation.findMany({ where, skip, take, include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, hostelRoom: { include: { hostel: true, room: true } } }, orderBy: { startsOn: 'desc' } }),
      this.prisma.hostelAllocation.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createHostelAllocation(dto: CreateHostelAllocationDto) {
    const organizationId = await this.org();
    const [student, hostelRoom] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, include: { user: { select: { id: true } } } }),
      this.prisma.hostelRoom.findFirst({ where: { id: dto.hostelRoomId, organizationId, deletedAt: null }, include: { hostel: true } }),
    ]);
    if (!student) throw new BadRequestException('Selected student does not exist');
    if (!hostelRoom) throw new BadRequestException('Selected hostel room does not exist');

    const [roomActiveAllocations, hostelActiveAllocations] = await Promise.all([
      this.prisma.hostelAllocation.count({ where: { hostelRoomId: hostelRoom.id, status: 'ACTIVE' } }),
      this.prisma.hostelAllocation.count({ where: { organizationId, hostelRoom: { hostelId: hostelRoom.hostelId }, status: 'ACTIVE' } }),
    ]);
    if (dto.status !== 'CANCELLED' && roomActiveAllocations >= hostelRoom.capacity) {
      throw new BadRequestException('Selected hostel room is already at capacity');
    }
    if (dto.status !== 'CANCELLED' && hostelRoom.hostel.capacityLimit && hostelActiveAllocations >= hostelRoom.hostel.capacityLimit) {
      throw new BadRequestException('Selected hostel is already at its capacity limit');
    }

    const allocation = await this.prisma.hostelAllocation.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        hostelRoomId: dto.hostelRoomId,
        startsOn: new Date(dto.startsOn),
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
        status: dto.status || 'ACTIVE',
      },
      include: { student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } }, hostelRoom: { include: { hostel: true, room: true } } },
    });

    await notifyUser(this.prisma, {
      organizationId,
      userId: student.user.id,
      type: 'SYSTEM',
      title: 'Hostel allocation assigned',
      body: `You have been assigned to ${allocation.hostelRoom.hostel.name}, room ${allocation.hostelRoom.roomNumber}.`,
      entityType: 'HostelAllocation',
      entityId: allocation.id,
      link: '/hostel-allocations',
      dedupeKey: allocation.id,
    });

    return allocation;
  }

  async payrollCycles(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.PayrollCycleWhereInput = {
      organizationId,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      status: query.status as never,
    };
    const [items, total] = await Promise.all([
      this.prisma.payrollCycle.findMany({ where, skip, take, include: { _count: { select: { payslips: true } } }, orderBy: { payDate: 'desc' } }),
      this.prisma.payrollCycle.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createPayrollCycle(dto: CreatePayrollCycleDto) {
    const organizationId = await this.org();
    return this.prisma.payrollCycle.create({
      data: {
        organizationId,
        name: dto.name,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        payDate: new Date(dto.payDate),
        status: dto.status || 'DRAFT',
      },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async updatePayrollCycle(id: string, dto: UpdatePayrollCycleDto) {
    const organizationId = await this.org();
    const cycle = await this.prisma.payrollCycle.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!cycle) throw new BadRequestException('Payroll cycle does not exist for the current organization');

    return this.prisma.payrollCycle.update({
      where: { id },
      data: {
        name: dto.name,
        startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
        payDate: dto.payDate ? new Date(dto.payDate) : undefined,
        status: dto.status,
      },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async employeeContracts(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.EmployeeContractWhereInput = {
      organizationId,
      title: query.title ? { equals: query.title, mode: 'insensitive' } : undefined,
      status: query.status as never,
      staff: query.staffEmail ? { user: { email: { equals: query.staffEmail, mode: 'insensitive' } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.employeeContract.findMany({ where, skip, take, include: { staff: { include: { user: { select: { email: true } } } } }, orderBy: { startsOn: 'desc' } }),
      this.prisma.employeeContract.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createEmployeeContract(dto: CreateEmployeeContractDto) {
    const organizationId = await this.org();
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!staff) throw new BadRequestException('Staff member does not exist for the current organization');

    return this.prisma.employeeContract.create({
      data: {
        organizationId,
        staffId: dto.staffId,
        title: dto.title,
        startsOn: new Date(dto.startsOn),
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
        baseSalary: dto.baseSalary,
        status: dto.status || 'ACTIVE',
      },
      include: { staff: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } },
    });
  }

  async payslips(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.PayslipWhereInput = {
      organizationId,
      status: query.status as never,
      staff: query.staffEmail ? { user: { email: { equals: query.staffEmail, mode: 'insensitive' } } } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.payslip.findMany({ where, skip, take, include: { staff: { include: { user: { select: { email: true } } } }, payrollCycle: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.payslip.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  private async assertStaffAndPayrollCycle(organizationId: string, dto: { staffId?: string; payrollCycleId?: string }) {
    if (dto.staffId) {
      const staff = await this.prisma.staff.findFirst({ where: { id: dto.staffId, organizationId, deletedAt: null }, select: { id: true } });
      if (!staff) throw new BadRequestException('Staff member does not exist for the current organization');
    }
    if (dto.payrollCycleId) {
      const cycle = await this.prisma.payrollCycle.findFirst({ where: { id: dto.payrollCycleId, organizationId }, select: { id: true } });
      if (!cycle) throw new BadRequestException('Payroll cycle does not exist for the current organization');
    }
  }

  async createPayslip(dto: CreatePayslipDto) {
    const organizationId = await this.org();
    await this.assertStaffAndPayrollCycle(organizationId, dto);
    return this.prisma.payslip.create({
      data: {
        organizationId,
        staffId: dto.staffId,
        payrollCycleId: dto.payrollCycleId,
        grossPay: dto.grossPay,
        deductions: dto.deductions ?? 0,
        netPay: dto.netPay,
        status: dto.status || 'DRAFT',
      },
      include: { staff: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, payrollCycle: true },
    });
  }

  async updatePayslip(id: string, dto: UpdatePayslipDto) {
    const organizationId = await this.org();
    const payslip = await this.prisma.payslip.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!payslip) throw new BadRequestException('Payslip does not exist for the current organization');
    await this.assertStaffAndPayrollCycle(organizationId, dto);

    return this.prisma.payslip.update({
      where: { id },
      data: {
        staffId: dto.staffId,
        payrollCycleId: dto.payrollCycleId,
        grossPay: dto.grossPay,
        deductions: dto.deductions,
        netPay: dto.netPay,
        status: dto.status,
      },
      include: { staff: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, payrollCycle: true },
    });
  }

  async leaveRequests(query: EnterpriseQuery, user?: RequestUser) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.LeaveRequestWhereInput = {
      organizationId,
      status: query.status as never,
      staff: query.staffEmail ? { user: { email: { equals: query.staffEmail, mode: 'insensitive' } } } : undefined,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
      OR: query.search ? [
        { reason: { contains: query.search, mode: 'insensitive' } },
        { staff: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
        { student: { studentId: { contains: query.search, mode: 'insensitive' } } },
        { student: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
      ] : undefined,
    };
    if (user?.role === UserRole.STUDENT) where.student = { userId: user.id };
    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        include: {
          staff: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
          student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, program: true, department: true } },
        },
        orderBy: { startsOn: 'desc' },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  private async resolveLeaveRequester(dto: { staffId?: string; studentId?: string }, user: RequestUser, organizationId: string) {
    if (user.role === UserRole.STUDENT) {
      const student = await this.prisma.student.findUnique({
        where: { userId: user.id },
        include: { user: { select: { id: true } } },
      });
      if (!student || student.organizationId !== organizationId || student.deletedAt) {
        throw new BadRequestException('Student profile does not exist for the current organization');
      }
      return { studentId: student.id, staffId: undefined, userId: student.user.id };
    }

    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: dto.studentId, organizationId, deletedAt: null },
        include: { user: { select: { id: true } } },
      });
      if (!student) throw new BadRequestException('Student does not exist for the current organization');
      return { studentId: student.id, staffId: undefined, userId: student.user.id };
    }

    if (dto.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: dto.staffId, organizationId, deletedAt: null },
        include: { user: { select: { id: true } } },
      });
      if (!staff) throw new BadRequestException('Staff member does not exist for the current organization');
      return { staffId: staff.id, studentId: undefined, userId: staff.user.id };
    }

    throw new BadRequestException('Choose a student or staff member for this leave request');
  }

  async createLeaveRequest(dto: CreateLeaveRequestDto, user: RequestUser) {
    const organizationId = await this.org();
    const requester = await this.resolveLeaveRequester(dto, user, organizationId);
    const leave = await this.prisma.leaveRequest.create({
      data: {
        organizationId,
        staffId: requester.staffId,
        studentId: requester.studentId,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
        reason: dto.reason,
        status: user.role === UserRole.STUDENT ? 'REQUESTED' : dto.status || 'REQUESTED',
      },
      include: {
        staff: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, program: true, department: true } },
      },
    });

    await notifyUser(this.prisma, {
      organizationId,
      userId: requester.userId,
      type: 'HR',
      priority: 'NORMAL',
      title: 'Leave request submitted',
      body: `Your leave request from ${new Date(dto.startsOn).toLocaleDateString()} to ${new Date(dto.endsOn).toLocaleDateString()} has been submitted.`,
      entityType: 'LeaveRequest',
      entityId: leave.id,
      link: '/leave-requests',
    });

    return leave;
  }

  async updateLeaveRequest(id: string, dto: UpdateLeaveRequestDto, user: RequestUser) {
    const organizationId = await this.org();
    const existing = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId },
      include: { student: { select: { userId: true } }, staff: { select: { userId: true } } },
    });
    if (!existing) throw new BadRequestException('Leave request does not exist for the current organization');
    if (user.role === UserRole.STUDENT && existing.student?.userId !== user.id) {
      throw new BadRequestException('You can only update your own leave requests');
    }

    const requester = (dto.studentId || dto.staffId) && user.role !== UserRole.STUDENT
      ? await this.resolveLeaveRequester(dto, user, organizationId)
      : { studentId: existing.studentId || undefined, staffId: existing.staffId || undefined };

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        staffId: requester.staffId,
        studentId: requester.studentId,
        startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
        reason: dto.reason,
        status: user.role === UserRole.STUDENT ? undefined : dto.status,
      },
      include: {
        staff: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        student: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, program: true, department: true } },
      },
    });
  }

  async updateLeaveRequestStatus(id: string, dto: UpdateLeaveRequestStatusDto) {
    const organizationId = await this.org();
    const existing = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new BadRequestException('Leave request does not exist in this organization');

    const leave = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: dto.status },
      include: {
        staff: { include: { user: { select: { id: true } } } },
        student: { include: { user: { select: { id: true } } } },
      },
    });

    await notifyUser(this.prisma, {
      organizationId,
      userId: leave.staff?.user.id || leave.student?.user.id,
      type: 'HR',
      priority: dto.status === 'APPROVED' ? 'NORMAL' : 'HIGH',
      title: `Leave request ${dto.status.toLowerCase()}`,
      body: `Your leave request has been ${dto.status.toLowerCase()}.${dto.reviewNote ? ` ${dto.reviewNote}` : ''}`,
      entityType: 'LeaveRequest',
      entityId: leave.id,
      link: '/leave-requests',
    });

    return leave;
  }

  async roles(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.RoleWhereInput = {
      organizationId,
      deletedAt: null,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      systemRole: query.systemRole as never,
    };
    const [items, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take,
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true, permissions: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.role.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  private async assertPermissions(organizationId: string, permissionIds: string[] = []) {
    if (!permissionIds.length) return;
    const count = await this.prisma.permission.count({ where: { organizationId, id: { in: permissionIds } } });
    if (count !== new Set(permissionIds).size) throw new BadRequestException('One or more permissions do not exist for the current organization');
  }

  async createRole(dto: CreateRoleDto) {
    const organizationId = await this.org();
    await this.assertPermissions(organizationId, dto.permissionIds);
    return this.prisma.role.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        systemRole: dto.systemRole,
        permissions: dto.permissionIds?.length
          ? { create: [...new Set(dto.permissionIds)].map((permissionId) => ({ permissionId })) }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const organizationId = await this.org();
    const role = await this.prisma.role.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    if (!role) throw new BadRequestException('Role does not exist for the current organization');
    await this.assertPermissions(organizationId, dto.permissionIds);

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        systemRole: dto.systemRole,
        permissions: dto.permissionIds
          ? {
              deleteMany: {},
              create: [...new Set(dto.permissionIds)].map((permissionId) => ({ permissionId })),
            }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true, permissions: true } },
      },
    });
  }

  async permissions(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.PermissionWhereInput = {
      organizationId,
      subject: query.subject || query.entity,
      action: query.action,
      OR: query.search ? [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { action: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take,
        include: {
          roles: { include: { role: true } },
          _count: { select: { roles: true } },
        },
        orderBy: [{ subject: 'asc' }, { action: 'asc' }],
      }),
      this.prisma.permission.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  private async assertRoles(organizationId: string, roleIds: string[] = []) {
    if (!roleIds.length) return;
    const count = await this.prisma.role.count({ where: { organizationId, deletedAt: null, id: { in: roleIds } } });
    if (count !== new Set(roleIds).size) throw new BadRequestException('One or more roles do not exist for the current organization');
  }

  async createPermission(dto: CreatePermissionDto) {
    const organizationId = await this.org();
    await this.assertRoles(organizationId, dto.roleIds);
    return this.prisma.permission.create({
      data: {
        organizationId,
        action: dto.action,
        subject: dto.subject,
        description: dto.description,
        roles: dto.roleIds?.length
          ? { create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: {
        roles: { include: { role: true } },
        _count: { select: { roles: true } },
      },
    });
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    const organizationId = await this.org();
    const permission = await this.prisma.permission.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!permission) throw new BadRequestException('Permission does not exist for the current organization');
    await this.assertRoles(organizationId, dto.roleIds);

    return this.prisma.permission.update({
      where: { id },
      data: {
        action: dto.action,
        subject: dto.subject,
        description: dto.description,
        roles: dto.roleIds
          ? {
              deleteMany: {},
              create: [...new Set(dto.roleIds)].map((roleId) => ({ roleId })),
            }
          : undefined,
      },
      include: {
        roles: { include: { role: true } },
        _count: { select: { roles: true } },
      },
    });
  }

  async auditLogs(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      action: query.action,
      entity: query.entity,
      user: query.userEmail ? { email: { equals: query.userEmail, mode: 'insensitive' } } : undefined,
      OR: query.search ? [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entity: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take, include: { user: { select: { email: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  private parseJsonInput(value: unknown, label: string): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return value as Prisma.InputJsonValue;
    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException(`${label} must be valid JSON`);
    }
  }

  async createAuditLog(dto: CreateAuditLogDto, currentUserId: string) {
    const organizationId = await this.org();
    const userId = dto.userId || currentUserId;
    if (userId) {
      const actor = await this.prisma.user.findFirst({ where: { id: userId, organizationId }, select: { id: true } });
      if (!actor) throw new BadRequestException('Audit actor does not exist for the current organization');
    }

    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: dto.action,
        entity: dto.entity,
        entityId: dto.entityId,
        before: this.parseJsonInput(dto.before, 'Before payload'),
        after: this.parseJsonInput(dto.after, 'After payload'),
        metadata: this.parseJsonInput(dto.metadata, 'Metadata'),
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
      },
      include: { user: { select: { email: true } } },
    });
  }

  async notifications(query: EnterpriseQuery, user?: RequestUser) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const status = query.status?.toUpperCase();
    const readState = activeFilter(query.isRead);
    const canViewTenantNotifications = user?.role === UserRole.ADMIN || user?.role === UserRole.TENANT_ADMIN;
    const where: Prisma.NotificationWhereInput = {
      organizationId,
      userId: canViewTenantNotifications ? undefined : user?.id,
      title: query.title ? { equals: query.title, mode: 'insensitive' } : undefined,
      type: query.type as never,
      priority: query.priority as never,
      channel: query.channel as never,
      entityType: query.entityType ? { equals: query.entityType, mode: 'insensitive' } : undefined,
      isRead: readState ?? (status === 'READ' ? true : status === 'UNREAD' ? false : undefined),
      user: query.userEmail ? { email: { equals: query.userEmail, mode: 'insensitive' } } : undefined,
      OR: query.search ? [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        include: {
          organization: { select: { name: true, slug: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createNotification(dto: CreateNotificationDto) {
    const organizationId = await this.org();
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('Selected notification recipient does not exist');

    return this.prisma.notification.create({
      data: {
        organizationId,
        userId: dto.userId,
        type: dto.type ?? 'SYSTEM',
        priority: dto.priority ?? 'NORMAL',
        channel: dto.channel ?? 'IN_APP',
        title: dto.title,
        body: dto.body,
        entityType: dto.entityType,
        entityId: dto.entityId,
        link: dto.link,
        deliveredAt: new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        organization: { select: { name: true, slug: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
  }

  async markNotificationRead(id: string, userId: string) {
    const organizationId = await this.org();
    const notification = await this.prisma.notification.findFirst({
      where: { id, organizationId, userId },
      select: { id: true },
    });
    if (!notification) throw new BadRequestException('Notification does not exist for the current user');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      include: {
        organization: { select: { name: true, slug: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
  }

  async bookReservations(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.BookReservationWhereInput = {
      organizationId,
      status: query.status as never,
      student: query.studentId ? { studentId: { equals: query.studentId, mode: 'insensitive' } } : undefined,
      book: query.bookTitle ? { title: { equals: query.bookTitle, mode: 'insensitive' } } : undefined,
      OR: query.search ? [
        { student: { studentId: { contains: query.search, mode: 'insensitive' } } },
        { student: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
        { book: { title: { contains: query.search, mode: 'insensitive' } } },
        { book: { author: { contains: query.search, mode: 'insensitive' } } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.bookReservation.findMany({
        where,
        skip,
        take,
        include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true, department: true } }, book: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bookReservation.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createBookReservation(dto: CreateBookReservationDto) {
    const organizationId = await this.org();
    const [student, book] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, include: { user: { select: { id: true } } } }),
      this.prisma.book.findFirst({ where: { id: dto.bookId, organizationId, deletedAt: null }, select: { id: true, title: true } }),
    ]);
    if (!student) throw new BadRequestException('Student does not exist for the current organization');
    if (!book) throw new BadRequestException('Book does not exist for the current organization');

    const reservation = await this.prisma.bookReservation.create({
      data: {
        organizationId,
        studentId: dto.studentId,
        bookId: dto.bookId,
        status: dto.status || 'ACTIVE',
        expiresAt: new Date(dto.expiresAt),
      },
      include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true, department: true } }, book: true },
    });

    await notifyUser(this.prisma, {
      organizationId,
      userId: student.user.id,
      type: 'LIBRARY',
      priority: 'NORMAL',
      title: 'Book reservation created',
      body: `Your reservation for "${book.title}" is active until ${new Date(dto.expiresAt).toLocaleDateString()}.`,
      entityType: 'BookReservation',
      entityId: reservation.id,
      link: '/book-reservations',
      dedupeKey: reservation.id,
    });

    return reservation;
  }

  async updateBookReservation(id: string, dto: UpdateBookReservationDto) {
    const organizationId = await this.org();
    const existing = await this.prisma.bookReservation.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Book reservation does not exist for the current organization');

    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, organizationId, deletedAt: null }, select: { id: true } });
      if (!student) throw new BadRequestException('Student does not exist for the current organization');
    }
    if (dto.bookId) {
      const book = await this.prisma.book.findFirst({ where: { id: dto.bookId, organizationId, deletedAt: null }, select: { id: true } });
      if (!book) throw new BadRequestException('Book does not exist for the current organization');
    }

    return this.prisma.bookReservation.update({
      where: { id },
      data: {
        studentId: dto.studentId,
        bookId: dto.bookId,
        status: dto.status,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } }, program: true, department: true } }, book: true },
    });
  }

  async removeBookReservation(id: string) {
    const organizationId = await this.org();
    const existing = await this.prisma.bookReservation.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new BadRequestException('Book reservation does not exist for the current organization');
    return this.prisma.bookReservation.delete({ where: { id } });
  }

  async announcements(query: EnterpriseQuery) {
    const organizationId = await this.org();
    const { skip, take, page, limit } = pagination(query);
    const status = query.status?.toUpperCase();
    const where: Prisma.AnnouncementWhereInput = {
      organizationId,
      deletedAt: null,
      title: query.title ? { equals: query.title, mode: 'insensitive' } : undefined,
      audience: query.audience as never,
      priority: query.priority as never,
      semesterId: query.semesterId,
      courseOfferingId: query.courseOfferingId,
      publishedAt: status === 'PUBLISHED' ? { not: null } : status === 'DRAFT' ? null : undefined,
      OR: query.search ? [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
        { createdBy: { email: { contains: query.search, mode: 'insensitive' } } },
      ] : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        skip,
        take,
        include: {
          organization: { select: { name: true, slug: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
          semester: { select: { id: true, name: true, term: true } },
          courseOffering: { include: { course: { select: { code: true, name: true } }, semester: { select: { name: true } } } },
          _count: { select: { reads: true, attachments: true } },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async createAnnouncement(dto: CreateAnnouncementDto, createdById: string) {
    const organizationId = await this.org();

    if (dto.semesterId) {
      const semester = await this.prisma.semester.findFirst({ where: { id: dto.semesterId, organizationId }, select: { id: true } });
      if (!semester) throw new BadRequestException('Selected semester does not exist');
    }
    if (dto.courseOfferingId) {
      const offering = await this.prisma.courseOffering.findFirst({ where: { id: dto.courseOfferingId, organizationId, deletedAt: null }, select: { id: true } });
      if (!offering) throw new BadRequestException('Selected course offering does not exist');
    }

    return this.prisma.announcement.create({
      data: {
        organizationId,
        title: dto.title,
        body: dto.body,
        audience: dto.audience ?? 'ALL',
        audienceScopeId: dto.audienceScopeId,
        semesterId: dto.semesterId,
        courseOfferingId: dto.courseOfferingId,
        priority: dto.priority ?? 'NORMAL',
        requiresAcknowledgment: dto.requiresAcknowledgment ?? false,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : dto.scheduledAt ? undefined : new Date(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdById,
      },
      include: {
        organization: { select: { name: true, slug: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        semester: { select: { id: true, name: true, term: true } },
        courseOffering: { include: { course: { select: { code: true, name: true } }, semester: { select: { name: true } } } },
        _count: { select: { reads: true, attachments: true } },
      },
    });
  }

  async markAnnouncementRead(id: string, userId: string) {
    const organizationId = await this.org();
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!announcement) throw new BadRequestException('Announcement does not exist');

    return this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      update: { readAt: new Date() },
      create: { organizationId, announcementId: id, userId },
      include: {
        announcement: { select: { id: true, title: true } },
        user: { select: { id: true, email: true } },
      },
    });
  }
}
