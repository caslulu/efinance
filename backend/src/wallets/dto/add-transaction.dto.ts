import { IsNumber, Min } from 'class-validator';

export class AddTransactionDto {
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than zero' })
  amount: number;
}
