import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmStatementImportRowDto {
  @IsDateString()
  transaction_date: string;

  @IsNumber()
  @Min(0.01)
  value: number;

  @IsEnum(['INCOME', 'EXPENSE'])
  transaction_type: 'INCOME' | 'EXPENSE';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  category_id?: number;

  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(2)
  installment_total?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  installment_number?: number;
}

export class ConfirmStatementImportDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmStatementImportRowDto)
  rows: ConfirmStatementImportRowDto[];
}
