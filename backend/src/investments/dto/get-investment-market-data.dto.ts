import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const DEFAULT_PERIODS = [1, 5, 30];

const splitCsv = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export class GetInvestmentMarketDataDto {
  @Transform(({ value }) =>
    splitCsv(value).map((symbol) => symbol.toUpperCase()),
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  symbols: string[];

  @Transform(({ value }) => {
    const parsed = splitCsv(value)
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry));

    return parsed.length > 0 ? parsed : DEFAULT_PERIODS;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(365, { each: true })
  periods: number[] = DEFAULT_PERIODS;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : 'BR',
  )
  @IsIn(['BR', 'GLOBAL'])
  market: 'BR' | 'GLOBAL' = 'BR';
}
