import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto';
import { CoursesService } from './courses.service';
import { CreateCoursePrerequisiteDto } from './dto/create-course-prerequisite.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findAll(@Query() query: PaginationQueryDto & { departmentId?: string; teacherId?: string }) {
    return this.courses.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.courses.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(id, dto);
  }

  @Post(':id/prerequisites')
  @Roles(UserRole.ADMIN)
  assignPrerequisite(@Param('id') id: string, @Body() dto: CreateCoursePrerequisiteDto) {
    return this.courses.assignPrerequisite(id, dto);
  }

  @Delete(':id/prerequisites/:prerequisiteCourseId')
  @Roles(UserRole.ADMIN)
  removePrerequisite(@Param('id') id: string, @Param('prerequisiteCourseId') prerequisiteCourseId: string) {
    return this.courses.removePrerequisite(id, prerequisiteCourseId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.courses.remove(id);
  }
}
