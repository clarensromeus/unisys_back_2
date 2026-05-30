import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateApplicationDocumentDto {
  @IsString()
  @MinLength(32)
  accessToken!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  fileUrl!: string;
}
