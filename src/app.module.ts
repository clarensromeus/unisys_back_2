import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/utils/redis.module';
import { EmailModule } from './common/utils/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { CoursesModule } from './modules/courses/courses.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExamsModule } from './modules/exams/exams.module';
import { ResultsModule } from './modules/results/results.module';
import { FinanceModule } from './modules/finance/finance.module';
import { LibraryModule } from './modules/library/library.module';
import { HrModule } from './modules/hr/hr.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { StudentFilesModule } from './modules/student-files/student-files.module';
import { ApplicationsModule } from './modules/applications/applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),
    PrismaModule,
    RedisModule,
    EmailModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    StudentsModule,
    TeachersModule,
    DepartmentsModule,
    CoursesModule,
    AttendanceModule,
    ExamsModule,
    ResultsModule,
    FinanceModule,
    LibraryModule,
    HrModule,
    EnterpriseModule,
    StudentFilesModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
