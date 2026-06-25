import 'dotenv/config';
import {
  AcademicStanding,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProgramLevel,
  StudentStatus,
  TransactionType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const rows = [
  ['SCI', 'Sciences', 'Science Studies', 'BSC-SCI', 'BSc Sciences', 'science.revenue@northbridge.edu', 'STU-R201', 3120],
  ['LAW', 'Droit', 'Law Department', 'LLB-LAW', 'LLB Law', 'law.revenue@northbridge.edu', 'STU-R202', 2410],
  ['LTR', 'Lettres', 'Letters Department', 'BA-LTR', 'BA Lettres', 'letters.revenue@northbridge.edu', 'STU-R203', 1980],
  ['MED', 'Médecine', 'Medicine Department', 'MD-MED', 'Doctor of Medicine', 'medicine.revenue@northbridge.edu', 'STU-R204', 1840],
  ['ECO', 'Économie', 'Economics Department', 'BSC-ECO', 'BSc Economics', 'economics.revenue@northbridge.edu', 'STU-R205', 1660],
  ['AGR', 'Agronomie', 'Agronomy Department', 'BSC-AGR', 'BSc Agronomy', 'agronomy.revenue@northbridge.edu', 'STU-R206', 1420],
  ['ART', 'Arts', 'Arts Department', 'BA-ART', 'BA Arts', 'arts.revenue@northbridge.edu', 'STU-R207', 1260],
  ['EDU', 'Éducation', 'Education Department', 'BED-EDU', 'Bachelor of Education', 'education.revenue@northbridge.edu', 'STU-R208', 1140],
  ['NUR', 'Sciences infirmières', 'Nursing Department', 'BSN-NUR', 'BSc Nursing', 'nursing.revenue@northbridge.edu', 'STU-R209', 980],
  ['ARC', 'Architecture', 'Architecture Department', 'BAR-ARC', 'Bachelor of Architecture', 'architecture.revenue@northbridge.edu', 'STU-R210', 760],
] as const;

async function main() {
  const password = await bcrypt.hash('Password123!', 12);
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: 'northbridge' } });
  const semester = await prisma.semester.findFirstOrThrow({
    where: { organizationId: org.id, isActive: true },
    orderBy: { startsOn: 'desc' },
  });

  for (const [code, facultyName, departmentName, programCode, programName, email, studentNo, amount] of rows) {
    const faculty = await prisma.faculty.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      update: { name: facultyName },
      create: { organizationId: org.id, code, name: facultyName },
    });
    const department = await prisma.department.upsert({
      where: { organizationId_code: { organizationId: org.id, code: `${code}-DPT` } },
      update: { facultyId: faculty.id, name: departmentName },
      create: { organizationId: org.id, facultyId: faculty.id, code: `${code}-DPT`, name: departmentName },
    });
    const program = await prisma.program.upsert({
      where: { organizationId_code: { organizationId: org.id, code: programCode } },
      update: { facultyId: faculty.id, departmentId: department.id, name: programName },
      create: {
        organizationId: org.id,
        facultyId: faculty.id,
        departmentId: department.id,
        code: programCode,
        name: programName,
        level: ProgramLevel.BACHELOR,
        durationTerms: 8,
        totalCredits: 120,
      },
    });
    const user = await prisma.user.upsert({
      where: { email },
      update: { organizationId: org.id, role: UserRole.STUDENT },
      create: {
        organizationId: org.id,
        email,
        password,
        role: UserRole.STUDENT,
        firstName: facultyName,
        lastName: 'Revenue',
      },
    });
    const student = await prisma.student.upsert({
      where: { organizationId_studentId: { organizationId: org.id, studentId: studentNo } },
      update: { userId: user.id, departmentId: department.id, programId: program.id, status: StudentStatus.ACTIVE },
      create: {
        organizationId: org.id,
        userId: user.id,
        studentId: studentNo,
        departmentId: department.id,
        programId: program.id,
        enrollmentDate: new Date('2025-08-18'),
        expectedGraduationDate: new Date('2029-06-01'),
        status: StudentStatus.ACTIVE,
        currentGpa: 3.0,
        cumulativeGpa: 3.0,
        completedCredits: 24,
        academicStanding: AcademicStanding.GOOD,
      },
    });
    const invoice = await prisma.invoice.upsert({
      where: { organizationId_invoiceNo: { organizationId: org.id, invoiceNo: `INV-${studentNo}` } },
      update: { studentId: student.id, semesterId: semester.id, status: InvoiceStatus.PAID, subtotal: amount, total: amount },
      create: {
        organizationId: org.id,
        studentId: student.id,
        semesterId: semester.id,
        invoiceNo: `INV-${studentNo}`,
        status: InvoiceStatus.PAID,
        subtotal: amount,
        discountTotal: 0,
        total: amount,
        dueDate: new Date('2026-02-01'),
        items: { create: [{ description: `${facultyName} tuition`, amount }] },
      },
    });
    const payment = await prisma.payment.upsert({
      where: { organizationId_paymentNo: { organizationId: org.id, paymentNo: `PAY-${studentNo}` } },
      update: { invoiceId: invoice.id, studentId: student.id, amount, status: PaymentStatus.PAID },
      create: {
        organizationId: org.id,
        invoiceId: invoice.id,
        studentId: student.id,
        paymentNo: `PAY-${studentNo}`,
        amount,
        status: PaymentStatus.PAID,
        method: PaymentMethod.ONLINE,
        reference: `seed-payment-${studentNo}`,
      },
    });
    const transaction = await prisma.transaction.findFirst({
      where: { organizationId: org.id, paymentId: payment.id, type: TransactionType.TUITION },
    });
    if (!transaction) {
      await prisma.transaction.create({
        data: {
          organizationId: org.id,
          studentId: student.id,
          invoiceId: invoice.id,
          paymentId: payment.id,
          amount,
          status: PaymentStatus.PAID,
          type: TransactionType.TUITION,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
