import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createUserDto,
    });
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

  async updateTwoFactorSecret(id: number, secret: string) {
    return this.prisma.user.update({
      where: { id },
      data: { twoFactorSecret: secret },
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
        twoFactorSecret: null,
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

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
