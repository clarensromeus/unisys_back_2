import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma, StudentStatus, TransactionType, UserRole } from '@prisma/client';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { defaultOrganizationId } from '../../common/utils/tenant.util';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/utils/redis.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async stats(user?: RequestUser) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const role = user?.role as UserRole | undefined;
    const isTenantWideAdmin = role === UserRole.ADMIN || role === UserRole.TENANT_ADMIN;
    const cacheKey = `dashboard:stats:v7:${organizationId}:${role || 'ADMIN'}:${isTenantWideAdmin ? 'global' : user?.id || 'anonymous'}`;
    const cached = await this.getCachedStats(cacheKey);
    if (cached && typeof cached === 'object') return cached;

    if (role === UserRole.STUDENT && user) {
      const data = await this.studentDashboard(organizationId, user);
      await this.setCachedStats(cacheKey, data);
      return data;
    }
    if (role === UserRole.TEACHER && user) {
      const data = await this.teacherDashboard(organizationId, user);
      await this.setCachedStats(cacheKey, data);
      return data;
    }
    if (role === UserRole.ACCOUNTANT) {
      const data = await this.accountantDashboard(organizationId);
      await this.setCachedStats(cacheKey, data);
      return data;
    }
    if (role === UserRole.LIBRARIAN) {
      const data = await this.librarianDashboard(organizationId);
      await this.setCachedStats(cacheKey, data);
      return data;
    }

    const now = new Date();
    const [
      students,
      teachers,
      courses,
      revenue,
      auditLogs,
      applications,
      registrations,
      payments,
      borrows,
      examSchedules,
      exams,
      semesters,
      invoices,
      announcements,
      revenueOverview,
      academicOverview,
    ] = await Promise.all([
      this.prisma.student.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.teacher.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.course.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.transaction.aggregate({
        where: { organizationId, type: { not: TransactionType.PAYROLL } },
        _sum: { amount: true },
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.admissionApplication.findMany({
        where: { organizationId, deletedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { program: { select: { code: true, name: true } } },
      }),
      this.prisma.courseRegistration.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { registeredAt: 'desc' },
        include: {
          student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
          course: { select: { code: true, name: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { paidAt: 'desc' },
        include: {
          student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
          invoice: { select: { invoiceNo: true } },
        },
      }),
      this.prisma.borrow.findMany({
        where: { organizationId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          book: { select: { title: true } },
          student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.examSchedule.findMany({
        where: { organizationId, startTime: { gte: now } },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: {
          room: { select: { code: true, name: true } },
          exam: {
            include: {
              course: { select: { code: true, name: true } },
              courseOffering: { include: { course: { select: { code: true, name: true } } } },
            },
          },
        },
      }),
      this.prisma.exam.findMany({
        where: { organizationId, date: { gte: now } },
        take: 5,
        orderBy: { date: 'asc' },
        include: {
          room: { select: { code: true, name: true } },
          course: { select: { code: true, name: true } },
          courseOffering: { include: { course: { select: { code: true, name: true } } } },
        },
      }),
      this.prisma.semester.findMany({
        where: { organizationId, startsOn: { gte: now } },
        take: 5,
        orderBy: { startsOn: 'asc' },
        include: { academicYear: { select: { name: true } } },
      }),
      this.prisma.invoice.findMany({
        where: { organizationId, dueDate: { gte: now }, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] } },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } },
      }),
      this.prisma.announcement.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [{ scheduledAt: { gte: now } }, { publishedAt: { gte: now } }, { expiresAt: { gte: now } }],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          semester: { select: { name: true } },
          courseOffering: { include: { course: { select: { code: true, name: true } } } },
        },
      }),
      this.revenueOverview(organizationId),
      this.academicOverview(organizationId),
    ]);

    const data = {
      role: 'ADMIN',
      title: 'Executive Dashboard',
      subtitle: 'University-wide operational health, activity, finance, and academic events.',
      students,
      teachers,
      courses,
      revenue: Number(revenue._sum.amount ?? new Prisma.Decimal(0)),
      revenueCards: revenueOverview.cards,
      revenueByFaculty: revenueOverview.byFaculty,
      recentAnnouncements: revenueOverview.announcements,
      enrollmentOverview: academicOverview.enrollment,
      studentDistribution: academicOverview.distribution,
      kpis: [
        ...revenueOverview.cards.map((card) => ({ ...card, icon: 'WalletCards' })),
      ],
      recentActivities: this.recentActivities({ auditLogs, applications, registrations, payments, borrows }),
      upcomingEvents: this.upcomingEvents({ examSchedules, exams, semesters, invoices, announcements }),
    };
    await this.setCachedStats(cacheKey, data);
    return data;
  }

  private async studentDashboard(organizationId: string, user: RequestUser) {
    const student = await this.prisma.student.findUnique({
      where: { userId: user.id },
      include: { program: true, department: true },
    });
    if (!student) return this.emptyRoleDashboard('STUDENT', 'Student Dashboard', 'No linked student record exists for this account yet.');

    const now = new Date();
    const [
      activeRegistrations,
      publishedResults,
      openInvoices,
      activeHolds,
      recentResults,
      recentPayments,
      leaveRequests,
      examSchedules,
      dueInvoices,
      borrows,
    ] = await Promise.all([
      this.prisma.courseRegistration.count({ where: { organizationId, studentId: student.id, status: { in: ['ENROLLED', 'WAITLISTED'] } } }),
      this.prisma.result.count({ where: { organizationId, studentId: student.id, isPublished: true } }),
      this.prisma.invoice.aggregate({
        where: { organizationId, studentId: student.id, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.studentHold.count({ where: { organizationId, studentId: student.id, status: 'ACTIVE' } }),
      this.prisma.result.findMany({
        where: { organizationId, studentId: student.id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { exam: { include: { course: true, courseOffering: { include: { course: true } } } } },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, studentId: student.id },
        take: 5,
        orderBy: { paidAt: 'desc' },
        include: { invoice: { select: { invoiceNo: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: { organizationId, studentId: student.id },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.examSchedule.findMany({
        where: {
          organizationId,
          startTime: { gte: now },
          exam: { courseOffering: { registrations: { some: { studentId: student.id } } } },
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: {
          room: { select: { code: true, name: true } },
          exam: { include: { course: true, courseOffering: { include: { course: true } } } },
        },
      }),
      this.prisma.invoice.findMany({
        where: { organizationId, studentId: student.id, dueDate: { gte: now }, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] } },
        take: 5,
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.borrow.findMany({
        where: { organizationId, studentId: student.id, returned: false },
        take: 5,
        orderBy: { dueDate: 'asc' },
        include: { book: { select: { title: true } } },
      }),
    ]);

    return {
      role: 'STUDENT',
      title: 'Student Dashboard',
      subtitle: `${student.program?.name || 'Program pending'} · ${student.department?.name || 'Department pending'}`,
      students: 1,
      teachers: 0,
      courses: activeRegistrations,
      revenue: Number(openInvoices._sum.total || 0),
      kpis: [
        { label: 'My Courses', value: activeRegistrations, detail: 'Active and waitlisted registrations', icon: 'BookOpen' },
        { label: 'Published Results', value: publishedResults, detail: 'Officially released grades', icon: 'Award' },
        { label: 'Balance Due', value: Number(openInvoices._sum.total || 0), format: 'money', detail: `${openInvoices._count} open invoices`, icon: 'WalletCards' },
        { label: 'Active Holds', value: activeHolds, detail: 'Academic or finance restrictions', icon: 'Shield' },
      ],
      recentActivities: [
        ...recentResults.map((item) => ({
          title: `${item.grade} in ${this.courseName(item.exam)}`,
          detail: `${Number(item.score).toLocaleString()} points · ${this.pretty(item.status)}`,
          type: 'result',
          timestamp: item.createdAt.toISOString(),
        })),
        ...recentPayments.map((item) => ({
          title: `Payment ${this.pretty(item.status)}`,
          detail: `${this.money(item.amount)}${item.invoice?.invoiceNo ? ` for ${item.invoice.invoiceNo}` : ''}`,
          type: 'finance',
          timestamp: item.paidAt.toISOString(),
        })),
        ...leaveRequests.map((item) => ({
          title: `Leave request ${this.pretty(item.status)}`,
          detail: item.reason,
          type: 'leave',
          timestamp: item.createdAt.toISOString(),
        })),
      ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)).slice(0, 8),
      upcomingEvents: [
        ...examSchedules.map((item) => ({
          title: item.exam.title,
          date: this.formatDateTime(item.startTime),
          location: `${this.courseName(item.exam)} · ${item.room.code || item.room.name}`,
          type: 'exam',
          timestamp: item.startTime.toISOString(),
        })),
        ...dueInvoices.map((item) => ({
          title: `${item.invoiceNo} due`,
          date: this.formatDate(item.dueDate),
          location: `${this.money(item.total)} outstanding`,
          type: 'finance',
          timestamp: item.dueDate.toISOString(),
        })),
        ...borrows.map((item) => ({
          title: `${item.book.title} due`,
          date: this.formatDate(item.dueDate),
          location: this.pretty(item.status),
          type: 'library',
          timestamp: item.dueDate.toISOString(),
        })),
      ].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)).slice(0, 8),
    };
  }

  private async teacherDashboard(organizationId: string, user: RequestUser) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id }, include: { department: true } });
    if (!teacher) return this.emptyRoleDashboard('TEACHER', 'Teacher Dashboard', 'No linked teacher record exists for this account yet.');

    const now = new Date();
    const [offerings, enrolledStudents, exams, pendingResults, recentRegistrations, recentResults, appeals, examSchedules] = await Promise.all([
      this.prisma.courseOffering.count({ where: { organizationId, instructorId: teacher.id, deletedAt: null } }),
      this.prisma.courseRegistration.count({ where: { organizationId, courseOffering: { instructorId: teacher.id }, status: 'ENROLLED' } }),
      this.prisma.exam.count({ where: { organizationId, courseOffering: { instructorId: teacher.id } } }),
      this.prisma.result.count({ where: { organizationId, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] }, exam: { courseOffering: { instructorId: teacher.id } } } }),
      this.prisma.courseRegistration.findMany({
        where: { organizationId, courseOffering: { instructorId: teacher.id } },
        take: 5,
        orderBy: { registeredAt: 'desc' },
        include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, course: true },
      }),
      this.prisma.result.findMany({
        where: { organizationId, exam: { courseOffering: { instructorId: teacher.id } } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, exam: { include: { course: true, courseOffering: { include: { course: true } } } } },
      }),
      this.prisma.resultAppeal.count({ where: { organizationId, status: 'PENDING', result: { exam: { courseOffering: { instructorId: teacher.id } } } } }),
      this.prisma.examSchedule.findMany({
        where: {
          organizationId,
          startTime: { gte: now },
          OR: [{ invigilatorId: teacher.id }, { exam: { courseOffering: { instructorId: teacher.id } } }],
        },
        take: 5,
        orderBy: { startTime: 'asc' },
        include: { room: true, exam: { include: { course: true, courseOffering: { include: { course: true } } } } },
      }),
    ]);

    return {
      role: 'TEACHER',
      title: 'Teacher Dashboard',
      subtitle: `${teacher.department?.name || 'Academic faculty'} teaching workspace`,
      students: enrolledStudents,
      teachers: 1,
      courses: offerings,
      revenue: 0,
      kpis: [
        { label: 'My Offerings', value: offerings, detail: 'Sections assigned to you', icon: 'BookOpen' },
        { label: 'Enrolled Students', value: enrolledStudents, detail: 'Across active offerings', icon: 'Users' },
        { label: 'Exams', value: exams, detail: 'Assessments under your courses', icon: 'ClipboardCheck' },
        { label: 'Pending Reviews', value: pendingResults + appeals, detail: 'Results and appeals needing action', icon: 'Shield' },
      ],
      recentActivities: [
        ...recentRegistrations.map((item) => ({
          title: `${this.person(item.student.user)} joined ${item.course.code}`,
          detail: this.pretty(item.status),
          type: 'registration',
          timestamp: item.registeredAt.toISOString(),
        })),
        ...recentResults.map((item) => ({
          title: `${this.person(item.student.user)} · ${this.courseName(item.exam)}`,
          detail: `${item.grade} · ${this.pretty(item.status)}`,
          type: 'result',
          timestamp: item.createdAt.toISOString(),
        })),
      ].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)).slice(0, 8),
      upcomingEvents: examSchedules.map((item) => ({
        title: item.exam.title,
        date: this.formatDateTime(item.startTime),
        location: `${this.courseName(item.exam)} · ${item.room.code || item.room.name}`,
        type: item.invigilatorId === teacher.id ? 'invigilation' : 'exam',
        timestamp: item.startTime.toISOString(),
      })),
    };
  }

  private async accountantDashboard(organizationId: string) {
    const now = new Date();
    const [payments, dueInvoices, revenueOverview, academicOverview] = await Promise.all([
      this.prisma.payment.findMany({ where: { organizationId }, take: 8, orderBy: { paidAt: 'desc' }, include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } }, invoice: true } }),
      this.prisma.invoice.findMany({ where: { organizationId, dueDate: { gte: now }, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] } }, take: 8, orderBy: { dueDate: 'asc' }, include: { student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } } }),
      this.revenueOverview(organizationId),
      this.academicOverview(organizationId),
    ]);
    return {
      role: 'ACCOUNTANT',
      title: 'Finance Dashboard',
      subtitle: 'Receivables, payments, expenses, and student billing work queue.',
      students: 0,
      teachers: 0,
      courses: 0,
      revenue: Number(revenueOverview.cards[0]?.value || 0),
      revenueCards: revenueOverview.cards,
      revenueByFaculty: revenueOverview.byFaculty,
      recentAnnouncements: revenueOverview.announcements,
      enrollmentOverview: academicOverview.enrollment,
      studentDistribution: academicOverview.distribution,
      kpis: [
        ...revenueOverview.cards.map((card) => ({ ...card, icon: 'WalletCards' })),
      ],
      recentActivities: payments.map((item) => ({
        title: `Payment ${item.paymentNo}`,
        detail: `${this.person(item.student.user)} · ${this.money(item.amount)}`,
        type: 'payment',
        timestamp: item.paidAt.toISOString(),
      })),
      upcomingEvents: dueInvoices.map((item) => ({
        title: `${item.invoiceNo} due`,
        date: this.formatDate(item.dueDate),
        location: `${this.person(item.student.user)} · ${this.money(item.total)}`,
        type: 'invoice',
        timestamp: item.dueDate.toISOString(),
      })),
    };
  }

  private async librarianDashboard(organizationId: string) {
    const now = new Date();
    const [books, activeBorrows, overdueBorrows, reservations, recentBorrows, expiringReservations] = await Promise.all([
      this.prisma.book.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.borrow.count({ where: { organizationId, returned: false, status: 'BORROWED' } }),
      this.prisma.borrow.count({ where: { organizationId, returned: false, OR: [{ status: 'OVERDUE' }, { dueDate: { lt: now } }] } }),
      this.prisma.bookReservation.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.borrow.findMany({ where: { organizationId }, take: 8, orderBy: { createdAt: 'desc' }, include: { book: true, student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } } }),
      this.prisma.bookReservation.findMany({ where: { organizationId, status: 'ACTIVE', expiresAt: { gte: now } }, take: 8, orderBy: { expiresAt: 'asc' }, include: { book: true, student: { include: { user: { select: { email: true, firstName: true, lastName: true } } } } } }),
    ]);
    return {
      role: 'LIBRARIAN',
      title: 'Library Dashboard',
      subtitle: 'Collections, borrowing, reservations, and overdue follow-up.',
      students: 0,
      teachers: 0,
      courses: 0,
      revenue: 0,
      kpis: [
        { label: 'Books', value: books, detail: 'Catalogued titles', icon: 'Library' },
        { label: 'Active Borrows', value: activeBorrows, detail: 'Books currently checked out', icon: 'BookOpen' },
        { label: 'Overdue', value: overdueBorrows, detail: 'Needs follow-up', icon: 'Shield' },
        { label: 'Reservations', value: reservations, detail: 'Active reservation queue', icon: 'CalendarClock' },
      ],
      recentActivities: recentBorrows.map((item) => ({
        title: item.book.title,
        detail: `${this.person(item.student.user)} · ${this.pretty(item.status)}`,
        type: 'borrow',
        timestamp: item.createdAt.toISOString(),
      })),
      upcomingEvents: expiringReservations.map((item) => ({
        title: `${item.book.title} reservation expires`,
        date: this.formatDate(item.expiresAt),
        location: this.person(item.student.user),
        type: 'reservation',
        timestamp: item.expiresAt.toISOString(),
      })),
    };
  }

  private async revenueOverview(organizationId: string) {
    const [students, teachers, staff, employees, collected, outstanding, payments, announcements] = await Promise.all([
      this.prisma.student.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.teacher.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.staff.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.employee.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.payment.aggregate({
        where: { organizationId, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, deletedAt: null, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.payment.findMany({
        where: { organizationId, status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] } },
        select: {
          amount: true,
          student: {
            select: {
              program: { select: { name: true, faculty: { select: { name: true } }, department: { select: { name: true } } } },
              department: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.announcement.findMany({
        where: { organizationId, deletedAt: null },
        take: 4,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          createdBy: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const collectedAmount = Number(collected._sum.amount || 0);
    const outstandingAmount = Number(outstanding._sum.total || 0);
    const activePersonnel = employees || teachers + staff;

    const facultyTotals = new Map<string, number>();
    for (const payment of payments) {
      const label = payment.student.program?.faculty?.name
        || payment.student.program?.department?.name
        || payment.student.department?.name
        || payment.student.program?.name
        || 'Unassigned';
      facultyTotals.set(label, (facultyTotals.get(label) || 0) + Number(payment.amount || 0));
    }
    const maxFacultyRevenue = Math.max(...facultyTotals.values(), 1);

    return {
      cards: [
        {
          label: 'Étudiants inscrits',
          value: students,
          detail: 'All active tenant student records',
          trend: '+3.4%',
          tone: 'positive',
        },
        {
          label: 'Personnel actif',
          value: activePersonnel,
          detail: 'Academic and administrative personnel',
          trend: '+0.6%',
          tone: 'positive',
        },
        {
          label: 'Revenue',
          value: collectedAmount,
          format: 'money',
          detail: `${collected._count} posted payments`,
          trend: '+3.4%',
          tone: 'positive',
        },
        {
          label: 'Impayé',
          value: outstandingAmount,
          format: 'money',
          detail: `${outstanding._count} open invoices`,
          trend: outstandingAmount > 0 ? '-1.2%' : '+0.0%',
          tone: outstandingAmount > 0 ? 'negative' : 'positive',
        },
      ],
      byFaculty: Array.from(facultyTotals.entries())
        .map(([name, revenue]) => ({
          name,
          revenue,
          percent: Math.round((revenue / maxFacultyRevenue) * 100),
        }))
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 10),
      announcements: announcements.map((item) => ({
        title: item.title,
        author: this.person(item.createdBy) || 'Rectorat',
        priority: this.pretty(item.priority),
        timestamp: (item.publishedAt || item.createdAt).toISOString(),
      })),
    };
  }

  private async academicOverview(organizationId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setMonth(monthStart.getMonth() - 11);
    const [registrations, registrationTrend, students] = await Promise.all([
      this.prisma.courseRegistration.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.courseRegistration.findMany({
        where: { organizationId, registeredAt: { gte: monthStart } },
        select: { registeredAt: true },
        orderBy: { registeredAt: 'asc' },
      }),
      this.prisma.student.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          status: true,
          department: { select: { name: true } },
          program: {
            select: {
              name: true,
              faculty: { select: { name: true } },
              department: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const totalRegistrations = registrations.reduce((sum, item) => sum + item._count._all, 0);
    const registrationRows = registrations
      .map((item) => ({
        label: this.pretty(item.status),
        value: item._count._all,
        percent: totalRegistrations ? Math.round((item._count._all / totalRegistrations) * 100) : 0,
      }))
      .sort((left, right) => right.value - left.value);

    const months = Array.from({ length: 12 }).map((_, index) => {
      const date = new Date(monthStart);
      date.setMonth(monthStart.getMonth() + index);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('fr', { month: 'short' }).format(date).replace('.', ''),
        count: 0,
      };
    });
    for (const registration of registrationTrend) {
      const date = registration.registeredAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const bucket = months.find((month) => month.key === key);
      if (bucket) bucket.count += 1;
    }
    let cumulative = 0;
    const trend = months.map((month, index) => {
      cumulative += month.count;
      const objective = Math.max(cumulative, Math.round(cumulative * 1.08 + index * 0.2));
      return {
        month: month.label.slice(0, 1).toUpperCase(),
        real: cumulative,
        objective,
      };
    });
    const previous = trend.at(-2)?.real || 0;
    const current = trend.at(-1)?.real || 0;
    const growth = previous ? ((current - previous) / previous) * 100 : current ? 100 : 0;

    const distributionTotals = new Map<string, number>();
    for (const student of students) {
      if (student.status !== StudentStatus.ACTIVE && student.status !== StudentStatus.GRADUATED && student.status !== StudentStatus.ALUMNI) continue;
      const label = student.program?.faculty?.name
        || student.program?.department?.name
        || student.department?.name
        || student.program?.name
        || 'Unassigned';
      distributionTotals.set(label, (distributionTotals.get(label) || 0) + 1);
    }

    const totalStudents = Array.from(distributionTotals.values()).reduce((sum, count) => sum + count, 0);
    return {
      enrollment: {
        total: totalRegistrations,
        rows: registrationRows,
        trend,
        growth: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`,
      },
      distribution: Array.from(distributionTotals.entries())
        .map(([name, count]) => ({
          name,
          count,
          percent: totalStudents ? Math.round((count / totalStudents) * 100) : 0,
        }))
        .sort((left, right) => right.count - left.count),
    };
  }

  private recentActivities(input: {
    auditLogs: Array<{
      action: string;
      entity: string;
      createdAt: Date;
      user?: { email: string; firstName?: string | null; lastName?: string | null } | null;
    }>;
    applications: Array<{ applicantName: string; status: string; applicationCode: string; createdAt: Date; program?: { code: string; name: string } | null }>;
    registrations: Array<{
      status: string;
      registeredAt: Date;
      student: { studentId: string; user?: { email: string; firstName?: string | null; lastName?: string | null } };
      course: { code: string; name: string };
    }>;
    payments: Array<{
      amount: Prisma.Decimal;
      status: string;
      paidAt: Date;
      invoice?: { invoiceNo: string } | null;
      student: { user?: { email: string; firstName?: string | null; lastName?: string | null } };
    }>;
    borrows: Array<{
      status: string;
      createdAt: Date;
      book: { title: string };
      student: { user?: { email: string; firstName?: string | null; lastName?: string | null } };
    }>;
  }) {
    return [
      ...input.auditLogs.map((item) => ({
        title: `${this.pretty(item.action)} ${this.pretty(item.entity)}`,
        detail: `${this.person(item.user) || 'System'} updated ERP records`,
        type: 'audit',
        timestamp: item.createdAt.toISOString(),
      })),
      ...input.applications.map((item) => ({
        title: `Admission ${this.pretty(item.status)}`,
        detail: `${item.applicantName} applied to ${item.program?.code || item.program?.name || 'a program'} (${item.applicationCode})`,
        type: 'admission',
        timestamp: item.createdAt.toISOString(),
      })),
      ...input.registrations.map((item) => ({
        title: `Course registration ${this.pretty(item.status)}`,
        detail: `${this.person(item.student.user) || item.student.studentId} registered for ${item.course.code} - ${item.course.name}`,
        type: 'academic',
        timestamp: item.registeredAt.toISOString(),
      })),
      ...input.payments.map((item) => ({
        title: `Payment ${this.pretty(item.status)}`,
        detail: `${this.person(item.student.user) || 'Student'} paid $${Number(item.amount).toLocaleString()}${item.invoice?.invoiceNo ? ` for ${item.invoice.invoiceNo}` : ''}`,
        type: 'finance',
        timestamp: item.paidAt.toISOString(),
      })),
      ...input.borrows.map((item) => ({
        title: `Library borrow ${this.pretty(item.status)}`,
        detail: `${this.person(item.student.user) || 'Student'} borrowed ${item.book.title}`,
        type: 'library',
        timestamp: item.createdAt.toISOString(),
      })),
    ]
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, 8);
  }

  private upcomingEvents(input: {
    examSchedules: Array<{
      startTime: Date;
      endTime: Date;
      room: { code: string; name: string };
      exam: {
        title: string;
        type: string;
        course?: { code: string; name: string } | null;
        courseOffering?: { course: { code: string; name: string } } | null;
      };
    }>;
    exams: Array<{
      id: string;
      title: string;
      type: string;
      date: Date;
      room?: { code: string; name: string } | null;
      course?: { code: string; name: string } | null;
      courseOffering?: { course: { code: string; name: string } } | null;
    }>;
    semesters: Array<{ name: string; startsOn: Date; endsOn: Date; academicYear: { name: string } }>;
    invoices: Array<{
      invoiceNo: string;
      total: Prisma.Decimal;
      dueDate: Date;
      student: { user?: { email: string; firstName?: string | null; lastName?: string | null } };
    }>;
    announcements: Array<{
      title: string;
      audience: string;
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
      expiresAt?: Date | null;
      semester?: { name: string } | null;
      courseOffering?: { course: { code: string; name: string } } | null;
    }>;
  }) {
    return [
      ...input.examSchedules.map((item) => {
        const course = item.exam.courseOffering?.course || item.exam.course;
        return {
          title: `${item.exam.title || this.pretty(item.exam.type)} schedule`,
          date: this.formatDateTime(item.startTime),
          location: `${course?.code || 'Exam'} · ${item.room.code || item.room.name}`,
          type: 'exam',
          timestamp: item.startTime.toISOString(),
        };
      }),
      ...input.exams.map((item) => {
        const course = item.courseOffering?.course || item.course;
        return {
          title: `${item.title || this.pretty(item.type)} exam`,
          date: this.formatDateTime(item.date),
          location: `${course?.code || 'Course'}${item.room ? ` · ${item.room.code || item.room.name}` : ''}`,
          type: 'exam',
          timestamp: item.date.toISOString(),
        };
      }),
      ...input.semesters.map((item) => ({
        title: `${item.name} begins`,
        date: this.formatDate(item.startsOn),
        location: item.academicYear.name,
        type: 'academic',
        timestamp: item.startsOn.toISOString(),
      })),
      ...input.invoices.map((item) => ({
        title: `Invoice ${item.invoiceNo} due`,
        date: this.formatDate(item.dueDate),
        location: `${this.person(item.student.user) || 'Student'} · $${Number(item.total).toLocaleString()}`,
        type: 'finance',
        timestamp: item.dueDate.toISOString(),
      })),
      ...input.announcements.map((item) => {
        const timestamp = item.scheduledAt || item.publishedAt || item.expiresAt || new Date();
        const target = item.courseOffering?.course?.code || item.semester?.name || this.pretty(item.audience);
        return {
          title: item.title,
          date: this.formatDateTime(timestamp),
          location: target,
          type: 'announcement',
          timestamp: timestamp.toISOString(),
        };
      }),
    ]
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .slice(0, 8);
  }

  private emptyRoleDashboard(role: string, title: string, subtitle: string) {
    return {
      role,
      title,
      subtitle,
      students: 0,
      teachers: 0,
      courses: 0,
      revenue: 0,
      kpis: [
        { label: 'Linked Records', value: 0, detail: subtitle, icon: 'Users' },
        { label: 'Open Work', value: 0, detail: 'Nothing requires attention yet', icon: 'ClipboardCheck' },
        { label: 'Upcoming Events', value: 0, detail: 'No scheduled items found', icon: 'CalendarClock' },
        { label: 'Notifications', value: 0, detail: 'No unread alerts found', icon: 'Megaphone' },
      ],
      recentActivities: [],
      upcomingEvents: [],
    };
  }

  private async getCachedStats(cacheKey: string) {
    try {
      return await this.redis.get<{
        students: number;
        teachers: number;
        courses: number;
        revenue: number;
        recentActivities?: Array<{ title: string; detail: string; type: string; timestamp: string }>;
        upcomingEvents?: Array<{ title: string; date: string; location: string; type: string; timestamp: string }>;
      }>(cacheKey);
    } catch {
      return null;
    }
  }

  private async setCachedStats(cacheKey: string, data: unknown) {
    try {
      await this.redis.set(cacheKey, data, 60);
    } catch {
      // Cache should never make the dashboard unavailable.
    }
  }

  private pretty(value: string) {
    return value
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private person(user?: { email: string; firstName?: string | null; lastName?: string | null } | null) {
    if (!user) return '';
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }

  private money(value: Prisma.Decimal | number | string | null | undefined) {
    return `$${Number(value || 0).toLocaleString()}`;
  }

  private courseName(exam?: {
    title?: string | null;
    type?: string | null;
    course?: { code?: string | null; name?: string | null } | null;
    courseOffering?: { course?: { code?: string | null; name?: string | null } | null } | null;
  } | null) {
    const course = exam?.courseOffering?.course || exam?.course;
    return [course?.code, course?.name].filter(Boolean).join(' - ') || exam?.title || (exam?.type ? this.pretty(exam.type) : 'Course');
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
  }

  private formatDateTime(value: Date) {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(value);
  }
}
