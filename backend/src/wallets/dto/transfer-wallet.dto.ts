import { IsInt, IsNumber, Min } from 'class-validator';

export class TransferWalletDto {
  @IsInt()
  @Min(1)
  fromWalletId: number;

  @IsInt()
  @Min(1)
  toWalletId: number;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
