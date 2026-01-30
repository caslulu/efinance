import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createWalletDto: CreateWalletDto) {
    return this.prisma.wallet.create({
      data: {
        ...createWalletDto,
        user_id: userId,
      },
    });
  }

  findAll(userId: number) {
    return this.prisma.wallet.findMany({
      where: { user_id: userId },
    });
  }

  async findOne(id: number, userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
    });
    
    // Check existence AND ownership
    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException(`Wallet #${id} not found`);
    }
    
    return wallet;
  }

  async addIncoming(id: number, userId: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    
    // Check if wallet exists and belongs to user
    await this.findOne(id, userId);

    return this.prisma.wallet.update({
      where: { id },
      data: {
        actual_cash: {
          increment: amount,
        },
      },
    });
  }

  async addExpense(id: number, userId: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Check ownership
    const wallet = await this.findOne(id, userId);
    const currentBalance = new Decimal(wallet.actual_cash);
    const expenseAmount = new Decimal(amount);

    if (currentBalance.lessThan(expenseAmount)) {
      throw new BadRequestException('Insufficient funds in wallet');
    }

    return this.prisma.wallet.update({
      where: { id },
      data: {
        actual_cash: {
          decrement: amount,
        },
      },
    });
  }

  async update(id: number, userId: number, updateWalletDto: UpdateWalletDto) {
    await this.findOne(id, userId); // Verify ownership
    return this.prisma.wallet.update({
      where: { id },
      data: updateWalletDto,
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId); // Verify ownership
    return this.prisma.wallet.delete({ where: { id } });
  }
}
