import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CreateSuperAdminDto } from './dto/create-superadmin.dto';
import { UpdateSuperAdminDto } from './dto/update-superadmin.dto';
import { UsersService } from './users.service';

@ApiTags('platform-superadmins')
@ApiHeader({ name: 'x-api-key', required: true })
@UseGuards(ApiKeyGuard)
@Controller('platform/superadmins')
export class PlatformSuperadminsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.users.findAllSuperAdmins(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOneSuperAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateSuperAdminDto) {
    return this.users.createSuperAdmin(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSuperAdminDto) {
    return this.users.updateSuperAdmin(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.removeSuperAdmin(id);
  }
}
