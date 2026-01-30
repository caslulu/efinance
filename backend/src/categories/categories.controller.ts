import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('categories')
@UseGuards(AuthGuard('jwt'))
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Request() req, @Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(req.user.userId, createCategoryDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.categoriesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, req.user.userId, updateCategoryDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id, req.user.userId);
  }
}
