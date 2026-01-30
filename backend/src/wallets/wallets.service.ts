import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWalletDto: CreateWalletDto) {
    return this.prisma.wallet.create({
      data: createWalletDto,
    });
  }

  findAll() {
    return this.prisma.wallet.findMany();
  }

  async findOne(id: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    if (!wallet) {
      throw new NotFoundException(`Wallet #${id} not found`);
    }
    return wallet;
  }

  async addIncoming(id: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    
    // Check if wallet exists first
    await this.findOne(id);

    return this.prisma.wallet.update({
      where: { id },
      data: {
        actual_cash: {
          increment: amount,
        },
      },
    });
  }

  async addExpense(id: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const wallet = await this.findOne(id);
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

  update(id: number, updateWalletDto: UpdateWalletDto) {
    return this.prisma.wallet.update({
      where: { id },
      data: updateWalletDto,
    });
  }

  remove(id: number) {
    return this.prisma.wallet.delete({ where: { id } });
  }
}
