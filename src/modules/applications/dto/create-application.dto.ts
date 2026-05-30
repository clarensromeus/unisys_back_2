import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class CreateApplicationDto {
  @IsUUID()
  programId!: string;

  @IsEmail()
  applicantEmail!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  applicantName!: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  @MaxLength(180)
  previousSchool?: string;
}
