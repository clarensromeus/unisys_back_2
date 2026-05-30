import { IsString, MinLength } from 'class-validator';

export class TrackApplicationDto {
  @IsString()
  @MinLength(8)
  applicationCode!: string;
}
