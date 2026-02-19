import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

export enum WishlistStore {
  AMAZON = 'AMAZON',
  MERCADOLIVRE = 'MERCADOLIVRE',
  SHOPEE = 'SHOPEE',
  SHEIN = 'SHEIN',
}

export class SearchStoreProductsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  query: string;

  @IsEnum(WishlistStore)
  store: WishlistStore;
}
