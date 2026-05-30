import { IsUUID } from 'class-validator';

export class LinkFacultyDto {
  @IsUUID()
  facultyId: string;
}
