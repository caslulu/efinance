import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateWishlistProductDto {
  @IsString()
  @IsNotEmpty()
  name_product: string;

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'URL inválida' })
  url?: string;
}
