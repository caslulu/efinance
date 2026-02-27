import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createUserDto: any) {
    const user = await this.prisma.user.create({
      data: createUserDto,
    });

    await this.prisma.transactionCategory.create({
      data: {
        name: 'Outro',
        user_id: user.id,
      },
    });

    return user;
  }

  async findByUsername(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
        ],
      },
    });
  }

  async findByResetToken(token: string) {
    return this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });
  }

  async setResetToken(id: number, token: string, expiry: Date) {
    return this.prisma.user.update({
      where: { id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });
  }

  async updatePassword(id: number, password: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  async setTwoFactorToken(id: number, token: string, expiry: Date) {
    return this.prisma.user.update({
      where: { id },
      data: {
        twoFactorToken: token,
        twoFactorTokenExpiry: expiry,
      },
    });
  }

  async enableTwoFactor(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: { isTwoFactorEnabled: true },
    });
  }

  async disableTwoFactor(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isTwoFactorEnabled: false,
        twoFactorToken: null,
        twoFactorTokenExpiry: null,
      },
    });
  }

  async setEmailVerificationToken(id: number, token: string, expiry: Date) {
    return this.prisma.user.update({
      where: { id },
      data: {
        emailVerificationToken: token,
        emailVerificationTokenExpiry: expiry,
      },
    });
  }

  async markEmailAsVerified(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const { password, currentPassword, birthDate, ...data } = updateUserDto;

    const updateData: any = { ...data };

    if (birthDate) {
      updateData.birthDate = new Date(birthDate);
    }

    if (password) {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (user.password) {
        if (!currentPassword) {
          throw new Error('A senha atual é necessária para alterar a senha.');
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          throw new Error('A senha atual está incorreta.');
        }
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async removeProfile(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete Wishlist related data
      const wishlists = await tx.wishlist.findMany({ where: { user_id: userId } });
      const wishlistIds = wishlists.map(w => w.id);

      const wishlistProducts = await tx.wishlistProduct.findMany({ where: { id_wishlist: { in: wishlistIds } } });
      const productIds = wishlistProducts.map(p => p.id);

      await tx.wishlistProductHistory.deleteMany({ where: { wishlist_product_id: { in: productIds } } });
      await tx.wishlistPriceAlertNotification.deleteMany({ where: { user_id: userId } });
      await tx.wishlistProduct.deleteMany({ where: { id_wishlist: { in: wishlistIds } } });
      await tx.wishlist.deleteMany({ where: { user_id: userId } });

      // 2. Delete Transactions and Investments
      const wallets = await tx.wallet.findMany({ where: { user_id: userId } });
      const walletIds = wallets.map(w => w.id);

      await tx.transaction.deleteMany({ where: { wallet_id: { in: walletIds } } });
      await tx.investment.deleteMany({ where: { wallet_id: { in: walletIds } } });

      // 3. Delete Subscriptions and Budgets
      await tx.subscription.deleteMany({ where: { user_id: userId } });
      await tx.budget.deleteMany({ where: { user_id: userId } });

      // 4. Delete Transaction Categories
      await tx.transactionCategory.deleteMany({ where: { user_id: userId } });

      // 5. Delete Wallets
      await tx.wallet.deleteMany({ where: { user_id: userId } });

      // 6. Delete User
      return tx.user.delete({ where: { id: userId } });
    });
  }
}
