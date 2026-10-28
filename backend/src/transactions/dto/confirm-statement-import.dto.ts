import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsInt,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmStatementImportRowDto {
  @IsDateString({ strict: true })
  transaction_date: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  value: number;

  @IsEnum(['INCOME', 'EXPENSE'])
  transaction_type: 'INCOME' | 'EXPENSE';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  category_id?: number;

  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(600)
  installment_total?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  installment_number?: number;
}

export class ConfirmStatementImportDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cardId?: number;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmStatementImportRowDto)
  rows: ConfirmStatementImportRowDto[];
}
