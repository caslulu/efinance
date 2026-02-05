import { IsString, IsNotEmpty, IsNumber, IsEnum, Min } from 'class-validator';

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
}