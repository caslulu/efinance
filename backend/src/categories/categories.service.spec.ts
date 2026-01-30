import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  transactionCategory: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;
  const userId = 1;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category for user', async () => {
      const dto = { name: 'Food' };
      const expected = { id: 1, user_id: userId, ...dto };
      mockPrismaService.transactionCategory.create.mockResolvedValue(expected);

      const result = await service.create(userId, dto);
      expect(result).toEqual(expected);
      expect(prisma.transactionCategory.create).toHaveBeenCalledWith({
        data: { ...dto, user_id: userId },
      });
    });
  });

  describe('findAll', () => {
    it('should return categories for user', async () => {
      const expected = [{ id: 1, name: 'Food', user_id: userId }];
      mockPrismaService.transactionCategory.findMany.mockResolvedValue(expected);

      const result = await service.findAll(userId);
      expect(result).toEqual(expected);
      expect(prisma.transactionCategory.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
    });
  });

  describe('findOne', () => {
    it('should return category if owned by user', async () => {
      const expected = { id: 1, name: 'Food', user_id: userId };
      mockPrismaService.transactionCategory.findUnique.mockResolvedValue(expected);

      const result = await service.findOne(1, userId);
      expect(result).toEqual(expected);
    });

    it('should throw NotFoundException if category belongs to another user', async () => {
      const otherUserCategory = { id: 1, name: 'Food', user_id: 99 };
      mockPrismaService.transactionCategory.findUnique.mockResolvedValue(otherUserCategory);

      await expect(service.findOne(1, userId)).rejects.toThrow(NotFoundException);
    });
  });
});
