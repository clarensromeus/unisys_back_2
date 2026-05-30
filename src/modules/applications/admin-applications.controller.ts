import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@ApiTags('admin applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateApplicationStatusDto, @CurrentUser() user: RequestUser) {
    return this.applications.updateStatus(id, dto, user.id);
  }
}
