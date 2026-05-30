import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateFacultyDto } from './create-faculty.dto';

export class UpdateFacultyDto extends PartialType(CreateFacultyDto) {
  @IsOptional()
  @IsUUID()
  headId?: string;
}
