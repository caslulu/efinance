import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createCategoryDto: CreateCategoryDto) {
    return this.prisma.transactionCategory.create({
      data: {
        ...createCategoryDto,
        user_id: userId,
      },
    });
  }

  findAll(userId: number) {
    return this.prisma.transactionCategory.findMany({
      where: { user_id: userId },
    });
  }

  async findOne(id: number, userId: number) {
    const category = await this.prisma.transactionCategory.findUnique({
      where: { id },
    });

    if (!category || category.user_id !== userId) {
      throw new NotFoundException(`Category #${id} not found`);
    }

    return category;
  }

  async update(id: number, userId: number, updateCategoryDto: UpdateCategoryDto) {
    await this.findOne(id, userId);

    return this.prisma.transactionCategory.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    return this.prisma.transactionCategory.delete({
      where: { id },
    });
  }
}
