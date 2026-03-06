import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return a token if credentials are valid', async () => {
      const loginDto = { username: 'test', password: 'password' };
      const user = { id: 1, username: 'test' };
      const result = { access_token: 'token' };

      jest.spyOn(authService, 'validateUser').mockResolvedValue(user as any);
      jest.spyOn(authService, 'login').mockResolvedValue(result as any);

      expect(await controller.login(loginDto, mockResponse)).toBe(result);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
        const loginDto = { username: 'test', password: 'wrong' };
        jest.spyOn(authService, 'validateUser').mockResolvedValue(null);
  
        await expect(controller.login(loginDto, mockResponse)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create a new user', async () => {
      const createUserDto = { username: 'newuser', email: 'test@example.com', password: 'password123' };
      const result = { id: 1, username: 'newuser', email: 'test@example.com' };

      jest.spyOn(authService, 'register').mockResolvedValue(result as any);

      expect(await controller.register(createUserDto)).toBe(result);
      expect(authService.register).toHaveBeenCalledWith(createUserDto);
    });
  });
});
