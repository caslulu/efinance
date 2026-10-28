import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeStatementDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  clarification?: string;

  @IsOptional()
  @IsEnum(['assisted', 'automatic'])
  mode?: 'assisted' | 'automatic';
}
