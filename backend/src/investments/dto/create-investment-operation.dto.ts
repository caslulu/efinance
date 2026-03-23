import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateInvestmentOperationDto {
  @IsNumber()
  @Min(1)
  wallet_id: number;

  @IsEnum(['BUY', 'SELL', 'DIVIDEND', 'JCP'])
  operation_type: 'BUY' | 'SELL' | 'DIVIDEND' | 'JCP';

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsEnum(['BR', 'GLOBAL'])
  market: 'BR' | 'GLOBAL';

  @IsDateString()
  transaction_date: string;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  unit_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  gross_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
