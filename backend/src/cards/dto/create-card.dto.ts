import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateCardDto {
  @IsNumber()
  @Min(1)
  wallet_id: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  flag: string;

  @IsNumber()
  @Min(1)
  @Max(31)
  closing_day: number;

  @IsNumber()
  @Min(1)
  @Max(31)
  due_day: number;

  @IsNumber()
  @Min(0)
  card_limit: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usable_limit?: number;
}
