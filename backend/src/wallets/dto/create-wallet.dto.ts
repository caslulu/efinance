import { IsString, IsNotEmpty, IsNumber, IsEnum, Min, IsOptional, Max } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['BANK', 'PHYSICAL', 'MEAL_VOUCHER', 'INVESTMENT', 'OTHER'], {
    message: 'Type must be BANK, PHYSICAL, MEAL_VOUCHER, INVESTMENT, or OTHER',
  })
  type: string;

  @IsNumber()
  @Min(0)
  actual_cash: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  closing_day?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  due_day?: number;
}