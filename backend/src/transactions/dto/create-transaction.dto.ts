import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, IsEnum, Min, IsDateString } from 'class-validator';

export class CreateTransactionDto {
  @IsDateString()
  transaction_date: string;

  @IsNumber()
  @Min(1)
  wallet_id: number;

  @IsEnum(['INCOME', 'EXPENSE'])
  transaction_type: string;

  @IsBoolean()
  is_recurring: boolean;

  @IsNumber()
  @Min(0.01)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  category_id?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  installment_total?: number;
}