import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => String(value).trim())
  search?: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() author?: string;
  @IsOptional() @IsString() categoryName?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() letter?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() statuses?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() isRead?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() term?: string;
  @IsOptional() @IsString() dayOfWeek?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() accountRole?: string;
  @IsOptional() @IsString() systemRole?: string;
  @IsOptional() @IsString() audience?: string;
  @IsOptional() @IsString() standing?: string;
  @IsOptional() @IsString() feeType?: string;
  @IsOptional() @IsString() returned?: string;
  @IsOptional() @IsString() isActive?: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() departmentName?: string;
  @IsOptional() @IsString() facultyId?: string;
  @IsOptional() @IsString() programId?: string;
  @IsOptional() @IsString() programName?: string;
  @IsOptional() @IsString() academicYearName?: string;
  @IsOptional() @IsString() semesterId?: string;
  @IsOptional() @IsString() semesterName?: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() courseOfferingId?: string;
  @IsOptional() @IsString() courseName?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() teacherName?: string;
  @IsOptional() @IsString() instructorName?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() staffEmail?: string;
  @IsOptional() @IsString() userEmail?: string;
  @IsOptional() @IsString() bookId?: string;
  @IsOptional() @IsString() bookTitle?: string;
  @IsOptional() @IsString() hostelId?: string;
  @IsOptional() @IsString() hostelName?: string;
  @IsOptional() @IsString() roomCode?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsString() published?: string;
}

export function pagination(query: PaginationQueryDto) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}
