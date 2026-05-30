import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { HrService } from './hr.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('staff')
  findAll(@Query() query: PaginationQueryDto) {
    return this.hr.findAll(query);
  }

  @Get('staff/:id')
  findOne(@Param('id') id: string) {
    return this.hr.findOne(id);
  }

  @Post('staff')
  create(@Body() dto: CreateStaffDto) {
    return this.hr.create(dto);
  }

  @Patch('staff/:id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.hr.update(id, dto);
  }

  @Delete('staff/:id')
  remove(@Param('id') id: string) {
    return this.hr.remove(id);
  }
}
