import { IsString, IsNotEmpty, IsNumber, IsEnum, IsDateString, Min, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0.01)
  value: number;

  @IsEnum(['INCOME', 'EXPENSE'])
  transaction_type: string;

  @IsEnum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
  frequency: string;

  @IsNumber()
  wallet_id: number;

  @IsNumber()
  category_id: number;

  @IsDateString()
  start_date: string;

  @IsOptional()
  @IsString()
  payment_method?: string;
}