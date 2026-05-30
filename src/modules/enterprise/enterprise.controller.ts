import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
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
import { EnterpriseService } from './enterprise.service';

@ApiTags('enterprise')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LIBRARIAN, UserRole.TEACHER)
@Controller('enterprise')
export class EnterpriseController {
  constructor(private readonly enterprise: EnterpriseService) {}

  @Get('subscription-plans') @Roles(UserRole.SUPER_ADMIN) subscriptionPlans(@Query() query: PaginationQueryDto) { return this.enterprise.subscriptionPlans(query); }
  @Post('subscription-plans') @Roles(UserRole.SUPER_ADMIN) createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) { return this.enterprise.createSubscriptionPlan(dto); }
  @Patch('subscription-plans/:id') @Roles(UserRole.SUPER_ADMIN) updateSubscriptionPlan(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) { return this.enterprise.updateSubscriptionPlan(id, dto); }
  @Get('tenant-subscriptions') @Roles(UserRole.SUPER_ADMIN) tenantSubscriptions(@Query() query: PaginationQueryDto) { return this.enterprise.tenantSubscriptions(query); }
  @Get('organizations') @Roles(UserRole.SUPER_ADMIN) organizations(@Query() query: PaginationQueryDto) { return this.enterprise.organizations(query); }
  @Post('organizations') @Roles(UserRole.SUPER_ADMIN) createOrganization(@Body() dto: CreateOrganizationDto) { return this.enterprise.createOrganization(dto); }
  @Get('organizations/:id/usage') @Roles(UserRole.SUPER_ADMIN) organizationUsage(@Param('id') id: string) { return this.enterprise.organizationUsage(id); }
  @Patch('organizations/:id/subscription') @Roles(UserRole.SUPER_ADMIN) updateOrganizationSubscription(@Param('id') id: string, @Body() dto: UpdateTenantSubscriptionDto) { return this.enterprise.updateOrganizationSubscription(id, dto); }
  @Get('organizations/:id/features') @Roles(UserRole.SUPER_ADMIN) tenantFeatures(@Param('id') id: string) { return this.enterprise.tenantFeatures(id); }
  @Patch('organizations/:id/features') @Roles(UserRole.SUPER_ADMIN) upsertTenantFeature(@Param('id') id: string, @Body() dto: UpsertTenantFeatureDto) { return this.enterprise.upsertTenantFeature(id, dto); }
  @Get('faculties') faculties(@Query() query: PaginationQueryDto) { return this.enterprise.faculties(query); }
  @Post('faculties') @Roles(UserRole.ADMIN) createFaculty(@Body() dto: CreateFacultyDto) { return this.enterprise.createFaculty(dto); }
  @Patch('faculties/:id') @Roles(UserRole.ADMIN) updateFaculty(@Param('id') id: string, @Body() dto: UpdateFacultyDto) { return this.enterprise.updateFaculty(id, dto); }
  @Get('employees') employees(@Query() query: PaginationQueryDto) { return this.enterprise.employees(query); }
  @Post('employees') @Roles(UserRole.ADMIN) createEmployee(@Body() dto: CreateEmployeeDto) { return this.enterprise.createEmployee(dto); }
  @Get('programs') programs(@Query() query: PaginationQueryDto) { return this.enterprise.programs(query); }
  @Post('programs') @Roles(UserRole.ADMIN) createProgram(@Body() dto: CreateProgramDto) { return this.enterprise.createProgram(dto); }
  @Patch('programs/:id') @Roles(UserRole.ADMIN) updateProgram(@Param('id') id: string, @Body() dto: UpdateProgramDto) { return this.enterprise.updateProgram(id, dto); }
  @Get('academic-years') academicYears(@Query() query: PaginationQueryDto) { return this.enterprise.academicYears(query); }
  @Get('semesters') semesters(@Query() query: PaginationQueryDto) { return this.enterprise.semesters(query); }
  @Post('semesters') @Roles(UserRole.ADMIN) createSemester(@Body() dto: CreateSemesterDto) { return this.enterprise.createSemester(dto); }
  @Get('admissions') admissions(@Query() query: PaginationQueryDto) { return this.enterprise.admissions(query); }
  @Get('course-offerings') offerings(@Query() query: PaginationQueryDto) { return this.enterprise.offerings(query); }
  @Post('course-offerings') @Roles(UserRole.ADMIN) createOffering(@Body() dto: CreateOfferingDto) { return this.enterprise.createOffering(dto); }
  @Patch('course-offerings/:id') @Roles(UserRole.ADMIN) updateOffering(@Param('id') id: string, @Body() dto: UpdateOfferingDto) { return this.enterprise.updateOffering(id, dto); }
  @Get('registrations') registrations(@Query() query: PaginationQueryDto) { return this.enterprise.registrations(query); }
  @Post('registrations') @Roles(UserRole.ADMIN) createRegistration(@Body() dto: CreateRegistrationDto) { return this.enterprise.createRegistration(dto); }
  @Patch('registrations/:id') @Roles(UserRole.ADMIN) updateRegistration(@Param('id') id: string, @Body() dto: UpdateRegistrationDto) { return this.enterprise.updateRegistration(id, dto); }
  @Get('invoices') invoices(@Query() query: PaginationQueryDto) { return this.enterprise.invoices(query); }
  @Post('invoices') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT) createInvoice(@Body() dto: CreateInvoiceDto) { return this.enterprise.createInvoice(dto); }
  @Get('payments') payments(@Query() query: PaginationQueryDto) { return this.enterprise.payments(query); }
  @Post('payments') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT) createPayment(@Body() dto: CreatePaymentDto) { return this.enterprise.createPayment(dto); }
  @Get('scholarships') scholarships(@Query() query: PaginationQueryDto) { return this.enterprise.scholarships(query); }
  @Post('scholarships') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT) createScholarship(@Body() dto: CreateScholarshipDto) { return this.enterprise.createScholarship(dto); }
  @Get('fee-structures') feeStructures(@Query() query: PaginationQueryDto) { return this.enterprise.feeStructures(query); }
  @Post('fee-structures') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT) createFeeStructure(@Body() dto: CreateFeeStructureDto) { return this.enterprise.createFeeStructure(dto); }
  @Get('student-holds') studentHolds(@Query() query: PaginationQueryDto) { return this.enterprise.studentHolds(query); }
  @Post('student-holds') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT) createStudentHold(@Body() dto: CreateStudentHoldDto) { return this.enterprise.createStudentHold(dto); }
  @Get('academic-progression') academicProgression(@Query() query: PaginationQueryDto) { return this.enterprise.academicProgression(query); }
  @Post('academic-progression') @Roles(UserRole.ADMIN) createAcademicProgression(@Body() dto: CreateAcademicProgressionDto) { return this.enterprise.createAcademicProgression(dto); }
  @Get('grade-scales') gradeScales(@Query() query: PaginationQueryDto) { return this.enterprise.gradeScales(query); }
  @Get('time-slots') timeSlots(@Query() query: PaginationQueryDto) { return this.enterprise.timeSlots(query); }
  @Post('time-slots') @Roles(UserRole.ADMIN) createTimeSlot(@Body() dto: CreateTimeSlotDto) { return this.enterprise.createTimeSlot(dto); }
  @Get('timetable') timetable(@Query() query: PaginationQueryDto) { return this.enterprise.timetable(query); }
  @Post('timetable') @Roles(UserRole.ADMIN) createTimetable(@Body() dto: CreateTimetableDto) { return this.enterprise.createTimetable(dto); }
  @Get('rooms') rooms(@Query() query: PaginationQueryDto) { return this.enterprise.rooms(query); }
  @Post('rooms') @Roles(UserRole.ADMIN) createRoom(@Body() dto: CreateRoomDto) { return this.enterprise.createRoom(dto); }
  @Get('hostels') hostels(@Query() query: PaginationQueryDto) { return this.enterprise.hostels(query); }
  @Post('hostels') @Roles(UserRole.ADMIN) createHostel(@Body() dto: CreateHostelDto) { return this.enterprise.createHostel(dto); }
  @Patch('hostels/:id/rooms') @Roles(UserRole.ADMIN) assignHostelRooms(@Param('id') id: string, @Body() dto: AssignHostelRoomsDto) { return this.enterprise.assignHostelRooms(id, dto); }
  @Get('hostel-rooms') hostelRooms(@Query() query: PaginationQueryDto) { return this.enterprise.hostelRooms(query); }
  @Get('hostel-allocations') hostelAllocations(@Query() query: PaginationQueryDto) { return this.enterprise.hostelAllocations(query); }
  @Post('hostel-allocations') @Roles(UserRole.ADMIN) createHostelAllocation(@Body() dto: CreateHostelAllocationDto) { return this.enterprise.createHostelAllocation(dto); }
  @Get('payroll-cycles') payrollCycles(@Query() query: PaginationQueryDto) { return this.enterprise.payrollCycles(query); }
  @Post('payroll-cycles') @Roles(UserRole.ADMIN) createPayrollCycle(@Body() dto: CreatePayrollCycleDto) { return this.enterprise.createPayrollCycle(dto); }
  @Patch('payroll-cycles/:id') @Roles(UserRole.ADMIN) updatePayrollCycle(@Param('id') id: string, @Body() dto: UpdatePayrollCycleDto) { return this.enterprise.updatePayrollCycle(id, dto); }
  @Get('employee-contracts') employeeContracts(@Query() query: PaginationQueryDto) { return this.enterprise.employeeContracts(query); }
  @Post('employee-contracts') @Roles(UserRole.ADMIN) createEmployeeContract(@Body() dto: CreateEmployeeContractDto) { return this.enterprise.createEmployeeContract(dto); }
  @Get('payslips') payslips(@Query() query: PaginationQueryDto) { return this.enterprise.payslips(query); }
  @Post('payslips') @Roles(UserRole.ADMIN) createPayslip(@Body() dto: CreatePayslipDto) { return this.enterprise.createPayslip(dto); }
  @Patch('payslips/:id') @Roles(UserRole.ADMIN) updatePayslip(@Param('id') id: string, @Body() dto: UpdatePayslipDto) { return this.enterprise.updatePayslip(id, dto); }
  @Get('leave-requests') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.TEACHER, UserRole.STUDENT) leaveRequests(@Query() query: PaginationQueryDto, @CurrentUser() user: RequestUser) { return this.enterprise.leaveRequests(query, user); }
  @Post('leave-requests') @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT) createLeaveRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: RequestUser) { return this.enterprise.createLeaveRequest(dto, user); }
  @Patch('leave-requests/:id') @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT) updateLeaveRequest(@Param('id') id: string, @Body() dto: UpdateLeaveRequestDto, @CurrentUser() user: RequestUser) { return this.enterprise.updateLeaveRequest(id, dto, user); }
  @Patch('leave-requests/:id/status') @Roles(UserRole.ADMIN) updateLeaveRequestStatus(@Param('id') id: string, @Body() dto: UpdateLeaveRequestStatusDto) { return this.enterprise.updateLeaveRequestStatus(id, dto); }
  @Get('roles') roles(@Query() query: PaginationQueryDto) { return this.enterprise.roles(query); }
  @Post('roles') @Roles(UserRole.ADMIN) createRole(@Body() dto: CreateRoleDto) { return this.enterprise.createRole(dto); }
  @Patch('roles/:id') @Roles(UserRole.ADMIN) updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) { return this.enterprise.updateRole(id, dto); }
  @Get('permissions') permissions(@Query() query: PaginationQueryDto) { return this.enterprise.permissions(query); }
  @Post('permissions') @Roles(UserRole.ADMIN) createPermission(@Body() dto: CreatePermissionDto) { return this.enterprise.createPermission(dto); }
  @Patch('permissions/:id') @Roles(UserRole.ADMIN) updatePermission(@Param('id') id: string, @Body() dto: UpdatePermissionDto) { return this.enterprise.updatePermission(id, dto); }
  @Get('audit-logs') auditLogs(@Query() query: PaginationQueryDto) { return this.enterprise.auditLogs(query); }
  @Post('audit-logs') @Roles(UserRole.ADMIN) createAuditLog(@Body() dto: CreateAuditLogDto, @CurrentUser() user: RequestUser) { return this.enterprise.createAuditLog(dto, user.id); }
  @Get('notifications') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LIBRARIAN, UserRole.TEACHER, UserRole.STUDENT) notifications(@Query() query: PaginationQueryDto, @CurrentUser() user: RequestUser) { return this.enterprise.notifications(query, user); }
  @Post('notifications') @Roles(UserRole.ADMIN) createNotification(@Body() dto: CreateNotificationDto) { return this.enterprise.createNotification(dto); }
  @Patch('notifications/:id/read') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LIBRARIAN, UserRole.TEACHER, UserRole.STUDENT) markNotificationRead(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.enterprise.markNotificationRead(id, user.id); }
  @Get('book-reservations') bookReservations(@Query() query: PaginationQueryDto) { return this.enterprise.bookReservations(query); }
  @Post('book-reservations') @Roles(UserRole.ADMIN, UserRole.LIBRARIAN) createBookReservation(@Body() dto: CreateBookReservationDto) { return this.enterprise.createBookReservation(dto); }
  @Patch('book-reservations/:id') @Roles(UserRole.ADMIN, UserRole.LIBRARIAN) updateBookReservation(@Param('id') id: string, @Body() dto: UpdateBookReservationDto) { return this.enterprise.updateBookReservation(id, dto); }
  @Delete('book-reservations/:id') @Roles(UserRole.ADMIN, UserRole.LIBRARIAN) removeBookReservation(@Param('id') id: string) { return this.enterprise.removeBookReservation(id); }
  @Get('announcements') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LIBRARIAN, UserRole.TEACHER, UserRole.STUDENT) announcements(@Query() query: PaginationQueryDto) { return this.enterprise.announcements(query); }
  @Post('announcements') @Roles(UserRole.ADMIN, UserRole.TEACHER) createAnnouncement(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: RequestUser) { return this.enterprise.createAnnouncement(dto, user.id); }
  @Patch('announcements/:id/read') @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.LIBRARIAN, UserRole.TEACHER, UserRole.STUDENT) markAnnouncementRead(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.enterprise.markAnnouncementRead(id, user.id); }
}
