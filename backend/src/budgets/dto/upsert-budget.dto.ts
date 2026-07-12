import { IsInt, IsNumber, Min } from 'class-validator';

export class UpsertBudgetDto {
  @IsInt()
  @Min(1)
  category_id: number;

  @IsNumber()
  @Min(0.01)
  limit: number;
}
