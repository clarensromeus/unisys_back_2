import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFacultyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(24)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}
