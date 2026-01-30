import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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

      jest.spyOn(authService, 'validateUser').mockResolvedValue(user);
      jest.spyOn(authService, 'login').mockResolvedValue(result);

      expect(await controller.login(loginDto)).toBe(result);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
        const loginDto = { username: 'test', password: 'wrong' };
        jest.spyOn(authService, 'validateUser').mockResolvedValue(null);
  
        await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create a new user', async () => {
      const createUserDto = { username: 'newuser', password: 'password123' };

      jest.spyOn(authService, 'register').mockResolvedValue(result as any);

      expect(await controller.register(createUserDto)).toBe(result);
      expect(authService.register).toHaveBeenCalledWith(createUserDto);
    });
  });
});
