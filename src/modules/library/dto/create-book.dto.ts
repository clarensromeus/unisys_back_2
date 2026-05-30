import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateBookDto {
  @IsString()
  title: string;

  @IsString()
  author: string;

  @IsOptional()
  @IsString()
  isbn?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsInt()
  @Min(0)
  copies: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  availableCopies?: number;
}
