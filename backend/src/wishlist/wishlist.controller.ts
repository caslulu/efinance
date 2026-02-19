import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import { WishlistService } from './wishlist.service';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';
import { CreateWishlistProductDto } from './dto/create-wishlist-product.dto';
import { UpdateWishlistProductDto } from './dto/update-wishlist-product.dto';
import { SearchStoreProductsDto } from './dto/search-store-products.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: {
    userId: number;
  };
};

@Controller('wishlists')
@UseGuards(AuthGuard('jwt'))
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post()
  create(
    @Request() req: AuthenticatedRequest,
    @Body() createWishlistDto: CreateWishlistDto,
  ) {
    return this.wishlistService.create(req.user.userId, createWishlistDto);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.wishlistService.findAll(req.user.userId);
  }

  @Get('search-products')
  searchProducts(@Query() searchStoreProductsDto: SearchStoreProductsDto) {
    return this.wishlistService.searchProducts(searchStoreProductsDto);
  }

  @Get(':id')
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.wishlistService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateWishlistDto: UpdateWishlistDto,
  ) {
    return this.wishlistService.update(id, req.user.userId, updateWishlistDto);
  }

  @Delete(':id')
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.wishlistService.remove(id, req.user.userId);
  }

  @Post(':wishlistId/products')
  addProduct(
    @Request() req: AuthenticatedRequest,
    @Param('wishlistId', ParseIntPipe) wishlistId: number,
    @Body() createWishlistProductDto: CreateWishlistProductDto,
  ) {
    return this.wishlistService.addProduct(
      wishlistId,
      req.user.userId,
      createWishlistProductDto,
    );
  }

  @Patch(':wishlistId/products/:productId')
  updateProduct(
    @Request() req: AuthenticatedRequest,
    @Param('wishlistId', ParseIntPipe) wishlistId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() updateWishlistProductDto: UpdateWishlistProductDto,
  ) {
    return this.wishlistService.updateProduct(
      wishlistId,
      productId,
      req.user.userId,
      updateWishlistProductDto,
    );
  }

  @Delete(':wishlistId/products/:productId')
  removeProduct(
    @Request() req: AuthenticatedRequest,
    @Param('wishlistId', ParseIntPipe) wishlistId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.wishlistService.removeProduct(
      wishlistId,
      productId,
      req.user.userId,
    );
  }
}
