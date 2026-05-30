import { Module } from '@nestjs/common';
import { StudentFilesController } from './student-files.controller';
import { StudentFilesService } from './student-files.service';

@Module({
  controllers: [StudentFilesController],
  providers: [StudentFilesService],
})
export class StudentFilesModule {}
