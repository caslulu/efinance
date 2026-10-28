import { IsString, IsNotEmpty, IsNumber, IsEnum, Min, IsBoolean, IsOptional } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['BANK', 'PHYSICAL', 'MEAL_VOUCHER', 'OTHER'], {
    message: 'Type must be BANK, PHYSICAL, MEAL_VOUCHER, or OTHER',
  })
  type: string;

  @IsNumber()
  @Min(0)
  actual_cash: number;

  @IsBoolean()
  @IsOptional()
  is_transfer_only?: boolean;
}