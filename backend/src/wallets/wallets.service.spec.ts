import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

const mockPrismaService = {
  wallet: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('WalletsService', () => {
  let service: WalletsService;
  let prisma: PrismaService;
  const userId = 1;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a wallet with initial balance', async () => {
      const createDto = {
        name: 'Main Stash',
        type: 'BANK',
        actual_cash: 100.00,
      };

      const expectedWallet = {
        id: 1,
        ...createDto,
        user_id: userId,
        actual_cash: new Decimal(100.00),
      };

      mockPrismaService.wallet.create.mockResolvedValue(expectedWallet);

      const result = await service.create(userId, createDto);
      expect(result).toEqual(expectedWallet);
      expect(prisma.wallet.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          user_id: userId,
        },
      });
    });
  });

  describe('addIncoming (Add Funds)', () => {
    it('should increase the wallet balance', async () => {
      const walletId = 1;
      const amount = 50.00;
      const currentWallet = {
        id: walletId,
        user_id: userId,
        actual_cash: new Decimal(100.00),
      };
      
      const updatedWallet = {
        id: walletId,
        user_id: userId,
        actual_cash: new Decimal(150.00),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(currentWallet);
      mockPrismaService.wallet.update.mockResolvedValue(updatedWallet);

      const result = await service.addIncoming(walletId, userId, amount);
      
      expect(result.actual_cash).toEqual(new Decimal(150.00));
      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: walletId },
        data: { actual_cash: { increment: amount } },
      });
    });

    it('should throw NotFoundException if wallet does not exist', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue(null);
      await expect(service.addIncoming(99, userId, 50)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if wallet belongs to another user', async () => {
      const walletId = 1;
      const otherUserId = 2;
      const wallet = {
        id: walletId,
        user_id: otherUserId,
        actual_cash: new Decimal(100.00),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(wallet);
      await expect(service.addIncoming(walletId, userId, 50)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if amount is negative or zero', async () => {
      await expect(service.addIncoming(1, userId, -10)).rejects.toThrow(BadRequestException);
      await expect(service.addIncoming(1, userId, 0)).rejects.toThrow(BadRequestException);
    });
  });

  describe('addExpense (Subtract Funds)', () => {
    it('should decrease the wallet balance if funds are sufficient', async () => {
      const walletId = 1;
      const amount = 40.00;
      const currentWallet = {
        id: walletId,
        user_id: userId,
        actual_cash: new Decimal(100.00),
      };
      
      const updatedWallet = {
        id: walletId,
        user_id: userId,
        actual_cash: new Decimal(60.00),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(currentWallet);
      mockPrismaService.wallet.update.mockResolvedValue(updatedWallet);

      const result = await service.addExpense(walletId, userId, amount);

      expect(result.actual_cash).toEqual(new Decimal(60.00));
    });

    it('should throw BadRequestException if expense > current balance (Insufficient Funds)', async () => {
      const walletId = 1;
      const currentWallet = {
        id: walletId,
        user_id: userId,
        actual_cash: new Decimal(100.00),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(currentWallet);

      await expect(service.addExpense(walletId, userId, amount)).rejects.toThrow(BadRequestException);
      expect(prisma.wallet.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if amount is negative or zero', async () => {
      await expect(service.addExpense(1, userId, -10)).rejects.toThrow(BadRequestException);
      await expect(service.addExpense(1, userId, 0)).rejects.toThrow(BadRequestException);
    });
  });
});
