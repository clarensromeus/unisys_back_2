import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDocumentDto } from './dto/create-application-document.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { TrackApplicationDto } from './dto/track-application.dto';
import { SubmitApplicationDocumentsDto } from './dto/submit-application-documents.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.applications.create(dto);
  }

  @Get('programs')
  programs() {
    return this.applications.programs();
  }

  @Get('track')
  track(@Query() query: TrackApplicationDto) {
    return this.applications.track(query);
  }

  @Post('documents')
  submitDocuments(@Body() dto: SubmitApplicationDocumentsDto) {
    return this.applications.submitDocuments(dto);
  }

  @Post(':id/documents')
  addDocument(@Param('id') id: string, @Body() dto: CreateApplicationDocumentDto) {
    return this.applications.addDocument(id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    return this.applications.update(id, dto);
  }
}
