import { PartialType } from '@nestjs/mapped-types';
import { CreateWishlistProductDto } from './create-wishlist-product.dto';

export class UpdateWishlistProductDto extends PartialType(
  CreateWishlistProductDto,
) {}
