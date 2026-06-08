import { Module } from '@nestjs/common';
import { PlatformSuperadminsController } from './platform-superadmins.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, PlatformSuperadminsController],
  providers: [UsersService],
})
export class UsersModule {}
