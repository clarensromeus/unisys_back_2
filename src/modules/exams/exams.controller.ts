import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExamType, UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { CreateGradingSchemeDto } from './dto/create-grading-scheme.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamsService } from './exams.service';

@ApiTags('exams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findAll(@Query() query: PaginationQueryDto & { courseId?: string; courseOfferingId?: string; type?: ExamType }, @CurrentUser() user: RequestUser) {
    return this.exams.findAll(query, user);
  }

  @Get('schedules')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  schedules(@Query() query: PaginationQueryDto & { examId?: string; roomId?: string; invigilatorId?: string }, @CurrentUser() user: RequestUser) {
    return this.exams.schedules(query, user);
  }

  @Post('schedules')
  @Roles(UserRole.ADMIN)
  createSchedule(@Body() dto: CreateExamScheduleDto) {
    return this.exams.createSchedule(dto);
  }

  @Get('grading-schemes')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  gradingSchemes(@Query() query: PaginationQueryDto & { courseOfferingId?: string; examType?: ExamType }, @CurrentUser() user: RequestUser) {
    return this.exams.gradingSchemes(query, user);
  }

  @Post('grading-schemes')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  createGradingScheme(@Body() dto: CreateGradingSchemeDto) {
    return this.exams.createGradingScheme(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findOne(@Param('id') id: string) {
    return this.exams.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@Body() dto: CreateExamDto) {
    return this.exams.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(@Param('id') id: string, @Body() dto: UpdateExamDto) {
    return this.exams.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.exams.remove(id);
  }
}
