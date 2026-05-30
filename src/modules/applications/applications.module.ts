import { Module } from '@nestjs/common';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
