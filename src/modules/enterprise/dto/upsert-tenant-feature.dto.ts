import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertTenantFeatureDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  key: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  config?: Record<string, unknown>;
}
