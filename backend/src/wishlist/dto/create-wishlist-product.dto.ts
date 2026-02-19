import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateWishlistProductDto {
  @IsString()
  @IsNotEmpty()
  name_product: string;

  @IsNumber()
  @Min(0.01)
  price: number;
}
