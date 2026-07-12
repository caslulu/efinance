import { IsNumber, Min } from 'class-validator';

export class PayInvoiceDto {
  @IsNumber()
  @Min(1)
  sourceWalletId: number;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
