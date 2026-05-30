import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUrl, MaxLength, MinLength, ValidateNested } from 'class-validator';

class SubmittedApplicationDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  fileUrl!: string;
}

export class SubmitApplicationDocumentsDto {
  @IsString()
  @MinLength(8)
  applicationCode!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmittedApplicationDocumentDto)
  documents!: SubmittedApplicationDocumentDto[];
}
