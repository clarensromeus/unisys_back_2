import 'dotenv/config';
import {
  AcademicStanding,
  AdmissionStatus,
  AttendanceStatus,
  BorrowStatus,
  ContractStatus,
  EmployeeType,
  ExamType,
  FeeType,
  HostelAllocationStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PayrollStatus,
  PrismaClient,
  ProgramLevel,
  RegistrationStatus,
  RoomType,
  SemesterTerm,
  StudentStatus,
  TransactionType,
  UserRole,
  WeekDay,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Password123!', 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'northbridge' },
    update: {},
    create: { name: 'Northbridge University', slug: 'northbridge', timezone: 'America/Los_Angeles' },
  });

  const permissionKeys = [
    ['manage', 'all'],
    ['read', 'students'],
    ['manage', 'students'],
    ['read', 'finance'],
    ['manage', 'finance'],
    ['read', 'library'],
    ['manage', 'library'],
    ['read', 'academics'],
    ['manage', 'academics'],
    ['manage', 'hr'],
  ];
  const permissions = await Promise.all(
    permissionKeys.map(([action, subject]) =>
      prisma.permission.upsert({
        where: { organizationId_action_subject: { organizationId: org.id, action, subject } },
        update: {},
        create: { organizationId: org.id, action, subject, description: `${action} ${subject}` },
      }),
    ),
  );

  const roleMap = new Map<UserRole, string>();
  for (const role of Object.values(UserRole)) {
    const created = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name: role } },
      update: {},
      create: { organizationId: org.id, name: role, systemRole: role },
    });
    roleMap.set(role, created.id);
  }
  const adminRoleId = roleMap.get(UserRole.ADMIN);
  if (adminRoleId) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRoleId, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRoleId, permissionId: permission.id },
      });
    }
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@northbridge.edu' },
    update: { organizationId: org.id, role: UserRole.ADMIN },
    create: {
      organizationId: org.id,
      email: 'admin@northbridge.edu',
      password,
      role: UserRole.ADMIN,
      firstName: 'Morgan',
      lastName: 'Admin',
    },
  });
  if (adminRoleId) {
    const existingAssignment = await prisma.userRoleAssignment.findFirst({
      where: { userId: admin.id, roleId: adminRoleId, scopeType: null, scopeId: null },
    });
    if (!existingAssignment) {
      await prisma.userRoleAssignment.create({ data: { userId: admin.id, roleId: adminRoleId } });
    }
  }

  const engineering = await prisma.faculty.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'ENG' } },
    update: {},
    create: { organizationId: org.id, code: 'ENG', name: 'Faculty of Engineering and Computing' },
  });
  const businessFaculty = await prisma.faculty.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'BUS' } },
    update: {},
    create: { organizationId: org.id, code: 'BUS', name: 'School of Business' },
  });

  const cs = await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'CS' } },
    update: {},
    create: { organizationId: org.id, facultyId: engineering.id, code: 'CS', name: 'Computer Science' },
  });
  const financeDept = await prisma.department.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'FIN' } },
    update: {},
    create: { organizationId: org.id, facultyId: businessFaculty.id, code: 'FIN', name: 'Finance and Accounting' },
  });

  const program = await prisma.program.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'BSC-CS' } },
    update: {},
    create: {
      organizationId: org.id,
      facultyId: engineering.id,
      departmentId: cs.id,
      code: 'BSC-CS',
      name: 'BSc Computer Science',
      level: ProgramLevel.BACHELOR,
      durationTerms: 8,
      totalCredits: 128,
    },
  });
  const businessProgram = await prisma.program.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'BBA-FIN' } },
    update: { facultyId: businessFaculty.id, departmentId: financeDept.id },
    create: {
      organizationId: org.id,
      facultyId: businessFaculty.id,
      departmentId: financeDept.id,
      code: 'BBA-FIN',
      name: 'BBA Finance',
      level: ProgramLevel.BACHELOR,
      durationTerms: 8,
      totalCredits: 120,
    },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { organizationId_name: { organizationId: org.id, name: '2025/2026' } },
    update: { isActive: true },
    create: {
      organizationId: org.id,
      name: '2025/2026',
      startsOn: new Date('2025-08-15'),
      endsOn: new Date('2026-07-31'),
      isActive: true,
    },
  });
  const semester = await prisma.semester.upsert({
    where: {
      organizationId_academicYearId_term: {
        organizationId: org.id,
        academicYearId: academicYear.id,
        term: SemesterTerm.SPRING,
      },
    },
    update: { isActive: true },
    create: {
      organizationId: org.id,
      academicYearId: academicYear.id,
      name: 'Spring 2026',
      term: SemesterTerm.SPRING,
      startsOn: new Date('2026-01-12'),
      endsOn: new Date('2026-05-22'),
      addDropStartsOn: new Date('2026-01-12'),
      addDropEndsOn: new Date('2026-01-26'),
      isActive: true,
    },
  });

  const teacherUser = await prisma.user.upsert({
    where: { email: 'elena.morris@northbridge.edu' },
    update: { organizationId: org.id, role: UserRole.TEACHER },
    create: {
      organizationId: org.id,
      email: 'elena.morris@northbridge.edu',
      password,
      role: UserRole.TEACHER,
      firstName: 'Elena',
      lastName: 'Morris',
    },
  });
  const teacherEmployee = await prisma.employee.upsert({
    where: { organizationId_employeeNo: { organizationId: org.id, employeeNo: 'FAC-201' } },
    update: { organizationId: org.id, userId: teacherUser.id, employeeType: EmployeeType.ACADEMIC, designation: 'Professor of Artificial Intelligence' },
    create: {
      organizationId: org.id,
      userId: teacherUser.id,
      employeeNo: 'FAC-201',
      employeeType: EmployeeType.ACADEMIC,
      designation: 'Professor of Artificial Intelligence',
    },
  });
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: { organizationId: org.id, employeeId: teacherEmployee.id },
    create: {
      organizationId: org.id,
      userId: teacherUser.id,
      employeeId: teacherEmployee.id,
      departmentId: cs.id,
      employeeNo: 'FAC-201',
      specialization: 'Artificial Intelligence',
      officeLocation: 'Engineering Hall 4B',
    },
  });
  await prisma.department.update({ where: { id: cs.id }, data: { headId: teacherEmployee.id } });

  const course = await prisma.course.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'CS401' } },
    update: { creditHours: 4 },
    create: {
      organizationId: org.id,
      departmentId: cs.id,
      teacherId: teacher.id,
      code: 'CS401',
      name: 'AI Systems',
      description: 'Enterprise AI systems, governance, and deployment.',
      creditHours: 4,
    },
  });
  await prisma.programCourse.upsert({
    where: { programId_courseId: { programId: program.id, courseId: course.id } },
    update: {},
    create: { programId: program.id, courseId: course.id, semesterNo: 6, isRequired: true },
  });

  const offering = await prisma.courseOffering.upsert({
    where: { courseId_semesterId_section: { courseId: course.id, semesterId: semester.id, section: 'A' } },
    update: { capacity: 120, enrolledCount: 1 },
    create: {
      organizationId: org.id,
      courseId: course.id,
      semesterId: semester.id,
      instructorId: teacher.id,
      section: 'A',
      capacity: 120,
      waitlistCapacity: 20,
      enrolledCount: 1,
    },
  });

  const room = await prisma.room.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'A-204' } },
    update: {},
    create: { organizationId: org.id, code: 'A-204', name: 'AI Lecture Hall', type: RoomType.CLASSROOM, capacity: 140, building: 'Academic Block A' },
  });
  const timeSlot = await prisma.timeSlot.upsert({
    where: {
      organizationId_dayOfWeek_startsAt_endsAt: {
        organizationId: org.id,
        dayOfWeek: WeekDay.MONDAY,
        startsAt: '09:00',
        endsAt: '10:30',
      },
    },
    update: {},
    create: { organizationId: org.id, name: 'Mon 09:00', dayOfWeek: WeekDay.MONDAY, startsAt: '09:00', endsAt: '10:30' },
  });
  await prisma.timetable.upsert({
    where: { roomId_timeSlotId_courseOfferingId: { roomId: room.id, timeSlotId: timeSlot.id, courseOfferingId: offering.id } },
    update: {},
    create: { organizationId: org.id, roomId: room.id, timeSlotId: timeSlot.id, courseOfferingId: offering.id },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'ava.thompson@northbridge.edu' },
    update: { organizationId: org.id, role: UserRole.STUDENT },
    create: {
      organizationId: org.id,
      email: 'ava.thompson@northbridge.edu',
      password,
      role: UserRole.STUDENT,
      firstName: 'Ava',
      lastName: 'Thompson',
    },
  });
  const application = await prisma.admissionApplication.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {
      status: AdmissionStatus.ENROLLED,
      applicationCode: 'APP-2026-0001',
      accessToken: 'seeded-admission-access-token-000000000001',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: org.id,
      applicantEmail: studentUser.email,
      applicantName: 'Ava Thompson',
      phone: '+1 415 555 0198',
      nationality: 'United States',
      previousSchool: 'Bayview Preparatory Academy',
      applicationCode: 'APP-2026-0001',
      accessToken: 'seeded-admission-access-token-000000000001',
      programId: program.id,
      status: AdmissionStatus.ENROLLED,
      reviewedById: admin.id,
      reviewedAt: new Date('2024-08-01'),
    },
  });
  await prisma.admissionDocument.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      applicationId: application.id,
      name: 'Transcript',
      fileUrl: 'https://northbridge.example/uploads/transcript-ava-thompson.pdf',
    },
  });
  const student = await prisma.student.upsert({
    where: { organizationId_studentId: { organizationId: org.id, studentId: 'STU-1001' } },
    update: { organizationId: org.id, programId: program.id },
    create: {
      organizationId: org.id,
      userId: studentUser.id,
      studentId: 'STU-1001',
      departmentId: cs.id,
      programId: program.id,
      applicationId: application.id,
      enrollmentDate: new Date('2024-08-20'),
      expectedGraduationDate: new Date('2028-06-01'),
      status: StudentStatus.ACTIVE,
      currentGpa: 3.8,
      cumulativeGpa: 3.7,
      completedCredits: 82,
      academicStanding: AcademicStanding.HONORS,
    },
  });

  await prisma.courseRegistration.upsert({
    where: { studentId_courseOfferingId: { studentId: student.id, courseOfferingId: offering.id } },
    update: { courseId: course.id, status: RegistrationStatus.ENROLLED, registeredAt: new Date('2026-01-15') },
    create: { organizationId: org.id, studentId: student.id, courseId: course.id, courseOfferingId: offering.id, status: RegistrationStatus.ENROLLED, registeredAt: new Date('2026-01-15') },
  });

  const dashboardStudents = [
    { studentId: 'STU-1002', firstName: 'Noah', lastName: 'Brooks', email: 'noah.brooks@northbridge.edu', programId: businessProgram.id, departmentId: financeDept.id, status: StudentStatus.ACTIVE, registration: RegistrationStatus.ENROLLED, registeredAt: '2026-02-12' },
    { studentId: 'STU-1003', firstName: 'Mia', lastName: 'Chen', email: 'mia.chen@northbridge.edu', programId: program.id, departmentId: cs.id, status: StudentStatus.ACTIVE, registration: RegistrationStatus.WAITLISTED, registeredAt: '2026-03-08' },
    { studentId: 'STU-1004', firstName: 'Liam', lastName: 'Patel', email: 'liam.patel@northbridge.edu', programId: businessProgram.id, departmentId: financeDept.id, status: StudentStatus.LEAVE, registration: RegistrationStatus.DROPPED, registeredAt: '2026-04-17' },
    { studentId: 'STU-1005', firstName: 'Sophia', lastName: 'Garcia', email: 'sophia.garcia@northbridge.edu', programId: program.id, departmentId: cs.id, status: StudentStatus.ACTIVE, registration: RegistrationStatus.COMPLETED, registeredAt: '2026-05-22' },
    { studentId: 'STU-1006', firstName: 'Ethan', lastName: 'Wilson', email: 'ethan.wilson@northbridge.edu', programId: businessProgram.id, departmentId: financeDept.id, status: StudentStatus.ACTIVE, registration: RegistrationStatus.ENROLLED, registeredAt: '2026-06-02' },
    { studentId: 'STU-1007', firstName: 'Amara', lastName: 'Okafor', email: 'amara.okafor@northbridge.edu', programId: program.id, departmentId: cs.id, status: StudentStatus.ACTIVE, registration: RegistrationStatus.ENROLLED, registeredAt: '2026-06-18' },
  ];

  for (const item of dashboardStudents) {
    const seededUser = await prisma.user.upsert({
      where: { email: item.email },
      update: { organizationId: org.id, role: UserRole.STUDENT, firstName: item.firstName, lastName: item.lastName },
      create: {
        organizationId: org.id,
        email: item.email,
        password,
        role: UserRole.STUDENT,
        firstName: item.firstName,
        lastName: item.lastName,
      },
    });
    const seededStudent = await prisma.student.upsert({
      where: { organizationId_studentId: { organizationId: org.id, studentId: item.studentId } },
      update: {
        organizationId: org.id,
        userId: seededUser.id,
        departmentId: item.departmentId,
        programId: item.programId,
        status: item.status,
      },
      create: {
        organizationId: org.id,
        userId: seededUser.id,
        studentId: item.studentId,
        departmentId: item.departmentId,
        programId: item.programId,
        enrollmentDate: new Date('2025-08-18'),
        expectedGraduationDate: new Date('2029-06-01'),
        status: item.status,
        currentGpa: 3.2,
        cumulativeGpa: 3.1,
        completedCredits: 28,
        academicStanding: AcademicStanding.GOOD,
      },
    });
    await prisma.courseRegistration.upsert({
      where: { studentId_courseOfferingId: { studentId: seededStudent.id, courseOfferingId: offering.id } },
      update: { courseId: course.id, status: item.registration, registeredAt: new Date(item.registeredAt) },
      create: {
        organizationId: org.id,
        studentId: seededStudent.id,
        courseId: course.id,
        courseOfferingId: offering.id,
        status: item.registration,
        registeredAt: new Date(item.registeredAt),
      },
    });
  }

  await prisma.courseOffering.update({
    where: { id: offering.id },
    data: { enrolledCount: 4, waitlistedCount: 1 },
  });
  await prisma.attendance.upsert({
    where: { studentId_courseOfferingId_date: { studentId: student.id, courseOfferingId: offering.id, date: new Date('2026-05-01') } },
    update: {},
    create: { organizationId: org.id, studentId: student.id, courseId: course.id, courseOfferingId: offering.id, date: new Date('2026-05-01'), status: AttendanceStatus.PRESENT },
  });

  const exam = await prisma.exam.create({
    data: { organizationId: org.id, courseId: course.id, courseOfferingId: offering.id, date: new Date('2026-05-12'), type: ExamType.MIDTERM, weight: 30 },
  });
  const result = await prisma.result.upsert({
    where: { studentId_examId: { studentId: student.id, examId: exam.id } },
    update: {},
    create: { organizationId: org.id, studentId: student.id, examId: exam.id, score: 91, grade: 'A-', gradePoints: 3.7 },
  });
  await prisma.academicProgression.upsert({
    where: { studentId_semesterId: { studentId: student.id, semesterId: semester.id } },
    update: {},
    create: {
      organizationId: org.id,
      studentId: student.id,
      semesterId: semester.id,
      attemptedCredits: 16,
      earnedCredits: 16,
      termGpa: 3.8,
      cumulativeGpa: 3.7,
      standing: AcademicStanding.HONORS,
    },
  });

  const fee = await prisma.feeStructure.create({
    data: { organizationId: org.id, programId: program.id, feeType: FeeType.TUITION, name: 'BSc CS Tuition', amount: 4250, currency: 'HTG' },
  });
  for (const grade of [
    ['A', 90, 100, 4],
    ['B', 80, 89.99, 3],
    ['C', 70, 79.99, 2],
    ['D', 60, 69.99, 1],
    ['F', 0, 59.99, 0],
  ] as const) {
    await prisma.gradeScale.upsert({
      where: { organizationId_letter: { organizationId: org.id, letter: grade[0] } },
      update: {},
      create: { organizationId: org.id, letter: grade[0], minScore: grade[1], maxScore: grade[2], gradePoints: grade[3] },
    });
  }
  const scholarship = await prisma.scholarship.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'MERIT-25' } },
    update: {},
    create: { organizationId: org.id, code: 'MERIT-25', name: 'Merit Scholarship', discountPercent: 25 },
  });
  await prisma.studentScholarship.upsert({
    where: { studentId_scholarshipId: { studentId: student.id, scholarshipId: scholarship.id } },
    update: {},
    create: { studentId: student.id, scholarshipId: scholarship.id, startsOn: new Date('2026-01-12') },
  });
  const invoice = await prisma.invoice.upsert({
    where: { organizationId_invoiceNo: { organizationId: org.id, invoiceNo: 'INV-2026-0001' } },
    update: { status: InvoiceStatus.PAID },
    create: {
      organizationId: org.id,
      studentId: student.id,
      semesterId: semester.id,
      invoiceNo: 'INV-2026-0001',
      status: InvoiceStatus.PAID,
      subtotal: 4250,
      discountTotal: 0,
      total: 4250,
      dueDate: new Date('2026-02-01'),
      items: { create: [{ feeStructureId: fee.id, description: 'Spring tuition', amount: 4250 }] },
    },
  });
  const payment = await prisma.payment.upsert({
    where: { organizationId_paymentNo: { organizationId: org.id, paymentNo: 'PAY-2026-0001' } },
    update: {},
    create: {
      organizationId: org.id,
      invoiceId: invoice.id,
      studentId: student.id,
      paymentNo: 'PAY-2026-0001',
      amount: 4250,
      status: PaymentStatus.PAID,
      method: PaymentMethod.ONLINE,
      reference: 'seed-payment',
    },
  });
  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      invoiceId: invoice.id,
      paymentId: payment.id,
      amount: 4250,
      status: PaymentStatus.PAID,
      type: TransactionType.TUITION,
    },
  });

  const revenueSeedRows = [
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

  for (const [code, facultyName, departmentName, programCode, programName, email, studentNo, amount] of revenueSeedRows) {
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
    const seededProgram = await prisma.program.upsert({
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
    const seededUser = await prisma.user.upsert({
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
    const seededStudent = await prisma.student.upsert({
      where: { organizationId_studentId: { organizationId: org.id, studentId: studentNo } },
      update: { userId: seededUser.id, departmentId: department.id, programId: seededProgram.id, status: StudentStatus.ACTIVE },
      create: {
        organizationId: org.id,
        userId: seededUser.id,
        studentId: studentNo,
        departmentId: department.id,
        programId: seededProgram.id,
        enrollmentDate: new Date('2025-08-18'),
        expectedGraduationDate: new Date('2029-06-01'),
        status: StudentStatus.ACTIVE,
        currentGpa: 3.0,
        cumulativeGpa: 3.0,
        completedCredits: 24,
        academicStanding: AcademicStanding.GOOD,
      },
    });
    const seededInvoice = await prisma.invoice.upsert({
      where: { organizationId_invoiceNo: { organizationId: org.id, invoiceNo: `INV-${studentNo}` } },
      update: { studentId: seededStudent.id, semesterId: semester.id, status: InvoiceStatus.PAID, subtotal: amount, total: amount },
      create: {
        organizationId: org.id,
        studentId: seededStudent.id,
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
    const seededPayment = await prisma.payment.upsert({
      where: { organizationId_paymentNo: { organizationId: org.id, paymentNo: `PAY-${studentNo}` } },
      update: { invoiceId: seededInvoice.id, studentId: seededStudent.id, amount, status: PaymentStatus.PAID },
      create: {
        organizationId: org.id,
        invoiceId: seededInvoice.id,
        studentId: seededStudent.id,
        paymentNo: `PAY-${studentNo}`,
        amount,
        status: PaymentStatus.PAID,
        method: PaymentMethod.ONLINE,
        reference: `seed-payment-${studentNo}`,
      },
    });
    const existingTransaction = await prisma.transaction.findFirst({
      where: { organizationId: org.id, paymentId: seededPayment.id, type: TransactionType.TUITION },
    });
    if (!existingTransaction) {
      await prisma.transaction.create({
        data: {
          organizationId: org.id,
          studentId: seededStudent.id,
          invoiceId: seededInvoice.id,
          paymentId: seededPayment.id,
          amount,
          status: PaymentStatus.PAID,
          type: TransactionType.TUITION,
        },
      });
    }
  }

  await prisma.studentHold.deleteMany({ where: { organizationId: org.id, studentId: student.id, reason: 'Library fine pending review' } });
  await prisma.studentHold.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      type: 'FINANCIAL',
      status: 'ACTIVE',
      reason: 'Library fine pending review',
    },
  });
  const studentFile = await prisma.studentFile.upsert({
    where: { organizationId_fileNo: { organizationId: org.id, fileNo: 'STU-1001-FILE' } },
    update: { status: 'OPEN' },
    create: {
      organizationId: org.id,
      studentId: student.id,
      fileNo: 'STU-1001-FILE',
      title: 'Ava Thompson Academic File',
      status: 'OPEN',
    },
  });
  await prisma.studentFileRequest.deleteMany({
    where: { organizationId: org.id, studentId: student.id, reason: 'Requesting temporary closure after graduation audit is completed' },
  });
  await prisma.studentFileRequest.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      studentFileId: studentFile.id,
      requestedById: studentUser.id,
      type: 'CLOSE',
      status: 'PENDING',
      reason: 'Requesting temporary closure after graduation audit is completed',
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: 'finance@northbridge.edu' },
    update: { organizationId: org.id, role: UserRole.ACCOUNTANT },
    create: { organizationId: org.id, email: 'finance@northbridge.edu', password, role: UserRole.ACCOUNTANT, firstName: 'Owen', lastName: 'Blake' },
  });
  const staff = await prisma.staff.upsert({
    where: { userId: accountant.id },
    update: { organizationId: org.id },
    create: { organizationId: org.id, userId: accountant.id, employeeNo: 'EMP-002', role: 'Accountant', salary: 5100 },
  });
  await prisma.employeeContract.create({
    data: {
      organizationId: org.id,
      staffId: staff.id,
      title: 'Finance Officer',
      startsOn: new Date('2025-01-01'),
      baseSalary: 5100,
      status: ContractStatus.ACTIVE,
    },
  });
  const payrollCycle = await prisma.payrollCycle.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'May 2026' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'May 2026',
      startsOn: new Date('2026-05-01'),
      endsOn: new Date('2026-05-31'),
      payDate: new Date('2026-05-30'),
      status: PayrollStatus.APPROVED,
    },
  });
  await prisma.payslip.upsert({
    where: { staffId_payrollCycleId: { staffId: staff.id, payrollCycleId: payrollCycle.id } },
    update: {},
    create: { organizationId: org.id, staffId: staff.id, payrollCycleId: payrollCycle.id, grossPay: 5100, deductions: 250, netPay: 4850, status: PayrollStatus.APPROVED },
  });
  await prisma.leaveRequest.deleteMany({ where: { organizationId: org.id, staffId: staff.id, reason: 'Annual leave' } });
  await prisma.leaveRequest.create({
    data: {
      organizationId: org.id,
      staffId: staff.id,
      startsOn: new Date('2026-06-03'),
      endsOn: new Date('2026-06-07'),
      reason: 'Annual leave',
      status: 'APPROVED',
    },
  });

  const category = await prisma.bookCategory.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Computer Science' } },
    update: {},
    create: { organizationId: org.id, name: 'Computer Science' },
  });
  const book = await prisma.book.upsert({
    where: { organizationId_isbn: { organizationId: org.id, isbn: '978-1449373320' } },
    update: {},
    create: {
      organizationId: org.id,
      isbn: '978-1449373320',
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      categoryId: category.id,
      copies: 4,
      availableCopies: 3,
    },
  });
  await prisma.borrow.create({
    data: { organizationId: org.id, studentId: student.id, bookId: book.id, dueDate: new Date('2026-05-11'), status: BorrowStatus.BORROWED },
  });
  await prisma.bookReservation.deleteMany({ where: { organizationId: org.id, studentId: student.id, bookId: book.id } });
  await prisma.bookReservation.create({
    data: {
      organizationId: org.id,
      studentId: student.id,
      bookId: book.id,
      expiresAt: new Date('2026-05-20'),
    },
  });

  const hostel = await prisma.hostel.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'H-A' } },
    update: {},
    create: { organizationId: org.id, code: 'H-A', name: 'Maple Residence', address: 'North Campus' },
  });
  const hostelRoom = await prisma.hostelRoom.upsert({
    where: { hostelId_roomNumber: { hostelId: hostel.id, roomNumber: 'A-101' } },
    update: {},
    create: { organizationId: org.id, hostelId: hostel.id, roomNumber: 'A-101', capacity: 2, monthlyRate: 650 },
  });
  await prisma.hostelAllocation.create({
    data: { organizationId: org.id, studentId: student.id, hostelRoomId: hostelRoom.id, startsOn: new Date('2026-01-12'), status: HostelAllocationStatus.ACTIVE },
  });

  const notificationTitles = [
    'Course registration confirmed',
    'Midterm result published',
    'Tuition invoice generated',
    'Leave request approved',
    'Library book overdue',
    'Result appeal reviewed',
    'Financial hold placed',
    'Admission approved',
  ];
  await prisma.notification.deleteMany({ where: { organizationId: org.id, title: { in: notificationTitles.concat('ERP seed complete') } } });
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'REGISTRATION',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'Course registration confirmed',
        body: `You have successfully enrolled in ${course.code} - ${course.name}.`,
        entityType: 'CourseOffering',
        entityId: offering.id,
        link: '/courses',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'RESULT',
        priority: 'HIGH',
        channel: 'IN_APP',
        title: 'Midterm result published',
        body: `${course.name} midterm result is now available in your academic record.`,
        entityType: 'Result',
        entityId: result.id,
        link: '/results',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'FINANCE',
        priority: 'HIGH',
        channel: 'IN_APP',
        title: 'Tuition invoice generated',
        body: `Invoice ${invoice.invoiceNo} for $${Number(invoice.total).toLocaleString()} is due on ${invoice.dueDate.toLocaleDateString()}.`,
        entityType: 'Invoice',
        entityId: invoice.id,
        link: '/invoices',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: accountant.id,
        type: 'HR',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'Leave request approved',
        body: 'Your annual leave request for June 3-7 has been approved by HR.',
        entityType: 'LeaveRequest',
        entityId: staff.id,
        link: '/leave-requests',
        isRead: true,
        readAt: new Date(),
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'LIBRARY',
        priority: 'URGENT',
        channel: 'IN_APP',
        title: 'Library book overdue',
        body: `Your borrowed book "${book.title}" is 3 days overdue. Return it to avoid additional fines.`,
        entityType: 'Borrow',
        entityId: book.id,
        link: '/library',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'APPEAL',
        priority: 'NORMAL',
        channel: 'IN_APP',
        title: 'Result appeal reviewed',
        body: 'Your result appeal has been reviewed. Open the appeal record for the registrar decision.',
        entityType: 'ResultAppeal',
        entityId: student.id,
        link: '/result-appeals',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'FINANCE',
        priority: 'URGENT',
        channel: 'IN_APP',
        title: 'Financial hold placed',
        body: 'A financial hold has been placed on your account because a library fine is pending review.',
        entityType: 'StudentHold',
        entityId: student.id,
        link: '/financial-holds',
        deliveredAt: new Date(),
      },
      {
        organizationId: org.id,
        userId: studentUser.id,
        type: 'ADMISSION',
        priority: 'HIGH',
        channel: 'IN_APP',
        title: 'Admission approved',
        body: 'Congratulations! Your application has been approved and converted into a student profile.',
        entityType: 'AdmissionApplication',
        entityId: application.id,
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
  ];
  await prisma.announcement.deleteMany({ where: { organizationId: org.id, title: { in: announcementTitles.concat('Spring registration open') } } });
  await prisma.announcement.createMany({
    data: [
      {
        organizationId: org.id,
        title: 'Spring add/drop window closes Friday',
        body: 'Students may add or drop Spring courses until Friday at 5:00 PM. Requests after the deadline require department approval.',
        audience: 'STUDENTS',
        semesterId: semester.id,
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
        semesterId: semester.id,
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
        createdById: accountant.id,
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
        audienceScopeId: engineering.id,
        priority: 'NORMAL',
        publishedAt: new Date(),
        expiresAt: new Date('2026-06-10'),
        createdById: teacherUser.id,
      },
    ],
  });
  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: admin.id,
      action: 'SEED_ENTERPRISE_ERP',
      entity: 'System',
      metadata: { academicYear: academicYear.name, semester: semester.name, program: program.code },
      after: { organization: org.slug, courseOffering: offering.id },
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
