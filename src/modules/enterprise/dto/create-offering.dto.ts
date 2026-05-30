import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOfferingDto {
  @IsUUID()
  courseId: string;

  @IsUUID()
  semesterId: string;

  @IsUUID()
  @IsOptional()
  instructorId?: string;

  @IsString()
  section: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  waitlistCapacity?: number;
}
