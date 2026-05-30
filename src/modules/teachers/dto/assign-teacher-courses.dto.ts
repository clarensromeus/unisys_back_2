import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignTeacherCoursesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  courseIds: string[];
}
