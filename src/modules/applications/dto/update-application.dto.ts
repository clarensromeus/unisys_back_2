import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class UpdateApplicationDto {
  @IsString()
  @MinLength(32)
  accessToken!: string;

  @IsOptional()
  @IsString()
  @Transform(emptyToUndefined)
  @MinLength(2)
  @MaxLength(160)
  applicantName?: string;

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
