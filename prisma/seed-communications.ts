import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'northbridge' } });
  const [admin, finance, teacher, student] = await Promise.all([
    prisma.user.findFirst({ where: { organizationId: org.id, email: 'admin@northbridge.edu' } }),
    prisma.user.findFirst({ where: { organizationId: org.id, email: 'finance@northbridge.edu' } }),
    prisma.user.findFirst({ where: { organizationId: org.id, role: 'TEACHER' }, orderBy: { createdAt: 'asc' } }),
    prisma.user.findFirst({ where: { organizationId: org.id, role: 'STUDENT' }, orderBy: { createdAt: 'asc' } }),
  ]);
  const recipient = student ?? admin;
  if (!admin || !recipient) throw new Error('Seed requires at least admin and recipient users.');

  const [course, offering, semester, invoice, result, application, book, hold, staff] = await Promise.all([
    prisma.course.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'asc' } }),
    prisma.courseOffering.findFirst({ where: { organizationId: org.id }, include: { course: true, semester: true }, orderBy: { createdAt: 'asc' } }),
    prisma.semester.findFirst({ where: { organizationId: org.id }, orderBy: { startsOn: 'desc' } }),
    prisma.invoice.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.result.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.admissionApplication.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.book.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.studentHold.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
    prisma.staff.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const selectedCourse = offering?.course ?? course;
  const courseName = selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : 'CS101';
  const invoiceTotal = Number(invoice?.total ?? 500).toLocaleString();
  const dueDate = invoice?.dueDate ? invoice.dueDate.toLocaleDateString() : 'Dec 1';

  const notificationTitles = [
    'Course registration confirmed',
    'Midterm result published',
    'Tuition invoice generated',
    'Leave request approved',
    'Library book overdue',
    'Result appeal reviewed',
    'Financial hold placed',
    'Admission approved',
    'ERP seed complete',
  ];
  await prisma.notification.deleteMany({ where: { organizationId: org.id, title: { in: notificationTitles } } });
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'REGISTRATION',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'Course registration confirmed',
        body: `You have successfully enrolled in ${courseName}.`,
        entityType: 'CourseOffering',
        entityId: offering?.id,
        link: '/courses',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'RESULT',
        priority: 'HIGH',
        channel: 'IN_APP',
        title: 'Midterm result published',
        body: `${selectedCourse?.name ?? 'Mathematics'} result is now available in your academic record.`,
        entityType: 'Result',
        entityId: result?.id,
        link: '/results',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'FINANCE',
        priority: 'HIGH',
        channel: 'IN_APP',
        title: 'Tuition invoice generated',
        body: `You have a new invoice of $${invoiceTotal} due on ${dueDate}.`,
        entityType: 'Invoice',
        entityId: invoice?.id,
        link: '/invoices',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: finance?.id ?? admin.id,
        type: 'HR',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'Leave request approved',
        body: 'Your leave request has been approved by HR.',
        entityType: 'LeaveRequest',
        entityId: staff?.id,
        link: '/leave-requests',
        isRead: true,
        readAt: new Date(),
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'LIBRARY',
        priority: 'URGENT',
        channel: 'IN_APP',
        title: 'Library book overdue',
        body: `Your borrowed book "${book?.title ?? 'Data Structures'}" is 3 days overdue.`,
        entityType: 'Borrow',
        entityId: book?.id,
        link: '/library',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'APPEAL',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'Result appeal reviewed',
        body: 'Your result appeal has been reviewed.',
        entityType: 'ResultAppeal',
        entityId: result?.id,
        link: '/result-appeals',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'FINANCE',
        priority: 'URGENT',
        channel: 'IN_APP',
        title: 'Financial hold placed',
        body: 'A financial hold has been placed on your account.',
        entityType: 'StudentHold',
        entityId: hold?.id,
        link: '/financial-holds',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: recipient.id,
        type: 'ADMISSION',
        priority: 'HIGH',
        channel: 'IN_APP',
        title: 'Admission approved',
        body: 'Congratulations! Your application has been approved.',
        entityType: 'AdmissionApplication',
        entityId: application?.id,
        link: '/admissions',
        deliveredAt: new Date(),
      },
    ],
  });

  const announcementTitles = [
    'Spring add/drop window closes Friday',
    'Final examination timetable published',
    'Financial clearance required before exams',
    'Library extended hours during exam week',
    'Faculty research symposium registration',
    'Spring registration open',
  ];
  await prisma.announcement.deleteMany({ where: { organizationId: org.id, title: { in: announcementTitles } } });
  await prisma.announcement.createMany({
    data: [
      {
        organizationId: org.id,
        title: 'Spring add/drop window closes Friday',
        body: 'Students may add or drop Spring courses until Friday at 5:00 PM. Requests after the deadline require department approval.',
        audience: 'STUDENTS',
        semesterId: semester?.id,
        priority: 'HIGH',
        publishedAt: new Date(),
        expiresAt: new Date('2026-05-15'),
        createdById: admin.id,
      },
      {
        organizationId: org.id,
        title: 'Final examination timetable published',
        body: 'The final examination timetable is now available. Students should verify room allocations and report conflicts to the registrar.',
        audience: 'SEMESTER',
        semesterId: semester?.id,
        priority: 'HIGH',
        publishedAt: new Date(),
        expiresAt: new Date('2026-06-01'),
        createdById: admin.id,
      },
      {
        organizationId: org.id,
        title: 'Financial clearance required before exams',
        body: 'Students with outstanding balances or active financial holds must complete clearance before examination cards are released.',
        audience: 'STUDENTS',
        priority: 'URGENT',
        requiresAcknowledgment: true,
        publishedAt: new Date(),
        expiresAt: new Date('2026-05-30'),
        createdById: finance?.id ?? admin.id,
      },
      {
        organizationId: org.id,
        title: 'Library extended hours during exam week',
        body: 'The main library will remain open until midnight from May 18-24. Study rooms can be reserved through the library desk.',
        audience: 'ALL',
        priority: 'NORMAL',
        publishedAt: new Date(),
        expiresAt: new Date('2026-05-25'),
        createdById: admin.id,
      },
      {
        organizationId: org.id,
        title: 'Faculty research symposium registration',
        body: 'Teachers and graduate students are invited to register abstracts for the Engineering and Computing research symposium.',
        audience: 'FACULTY',
        priority: 'NORMAL',
        publishedAt: new Date(),
        expiresAt: new Date('2026-06-10'),
        createdById: teacher?.id ?? admin.id,
      },
    ],
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
