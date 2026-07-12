import { PartialType } from '@nestjs/mapped-types';
import { CreateTransactionDto } from './create-transaction.dto';
import { IsEnum, IsOptional } from 'class-validator';

export enum TransactionSeriesScope {
  THIS = 'THIS',
  THIS_AND_FUTURE = 'THIS_AND_FUTURE',
  ALL = 'ALL',
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  @IsOptional()
  @IsEnum(TransactionSeriesScope)
  series_scope?: TransactionSeriesScope;
}
