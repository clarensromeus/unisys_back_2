import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StudentFileRequestStatus, StudentFileRequestType, StudentFileStatus, UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateFileRequestDto } from './dto/create-file-request.dto';
import { ReviewFileRequestDto } from './dto/review-file-request.dto';
import { StudentFilesService } from './student-files.service';

@ApiTags('student-files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('student-files')
export class StudentFilesController {
  constructor(private readonly studentFiles: StudentFilesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  files(@Query() query: PaginationQueryDto & { status?: StudentFileStatus }, @CurrentUser() user: RequestUser) {
    return this.studentFiles.files(query, user);
  }

  @Get('requests')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  requests(@Query() query: PaginationQueryDto & { status?: StudentFileRequestStatus; type?: StudentFileRequestType }, @CurrentUser() user: RequestUser) {
    return this.studentFiles.requests(query, user);
  }

  @Post('requests')
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  createRequest(@Body() dto: CreateFileRequestDto, @CurrentUser() user: RequestUser) {
    return this.studentFiles.createRequest(dto, user);
  }

  @Patch('requests/:id/review')
  @Roles(UserRole.ADMIN)
  reviewRequest(@Param('id') id: string, @Body() dto: ReviewFileRequestDto, @CurrentUser() user: RequestUser) {
    return this.studentFiles.reviewRequest(id, dto, user);
  }
}
