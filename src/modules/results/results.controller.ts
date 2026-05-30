import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppealStatus, ResultWorkflowStatus, UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto';
import { CreateResultAppealDto } from './dto/create-result-appeal.dto';
import { CreateResultDto } from './dto/create-result.dto';
import { CreateTranscriptDto } from './dto/create-transcript.dto';
import { UpdateResultWorkflowDto } from './dto/update-result-workflow.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { UpdateResultAppealDto } from './dto/update-result-appeal.dto';
import { ResultsService } from './results.service';

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findAll(@Query() query: PaginationQueryDto & { studentId?: string; examId?: string; status?: ResultWorkflowStatus; isPublished?: string }, @CurrentUser() user: RequestUser) {
    return this.results.findAll(query, user);
  }

  @Get('appeals')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  appeals(@Query() query: PaginationQueryDto & { studentId?: string; resultId?: string; status?: AppealStatus }, @CurrentUser() user: RequestUser) {
    return this.results.appeals(query, user);
  }

  @Post('appeals')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  createAppeal(@Body() dto: CreateResultAppealDto) {
    return this.results.createAppeal(dto);
  }

  @Patch('appeals/:id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  updateAppeal(@Param('id') id: string, @Body() dto: UpdateResultAppealDto) {
    return this.results.updateAppeal(id, dto);
  }

  @Get('transcripts')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  transcripts(@Query() query: PaginationQueryDto & { studentId?: string; isOfficial?: string }, @CurrentUser() user: RequestUser) {
    return this.results.transcripts(query, user);
  }

  @Post('transcripts')
  @Roles(UserRole.ADMIN)
  createTranscript(@Body() dto: CreateTranscriptDto) {
    return this.results.createTranscript(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT)
  findOne(@Param('id') id: string) {
    return this.results.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  create(@Body() dto: CreateResultDto) {
    return this.results.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(@Param('id') id: string, @Body() dto: UpdateResultDto) {
    return this.results.update(id, dto);
  }

  @Patch(':id/workflow')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  updateWorkflow(@Param('id') id: string, @Body() dto: UpdateResultWorkflowDto) {
    return this.results.updateWorkflow(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.results.remove(id);
  }
}
