import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUsersService = {
  findByUsername: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(() => 'mockToken'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data (without password) if validation succeeds', async () => {
      const mockUser = {
        id: 1,
        username: 'test',
        password: 'hashedPassword',
      };
      
      jest.spyOn(mockUsersService, 'findByUsername').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test', 'password');
      expect(result).toEqual({ id: 1, username: 'test' });
    });

    it('should return null if validation fails', async () => {
      jest.spyOn(mockUsersService, 'findByUsername').mockResolvedValue(null);
      const result = await service.validateUser('test', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return an access token', async () => {
      const result = await service.login({ username: 'test', id: 1 });
      expect(result).toEqual({ access_token: 'mockToken' });
    });
  });
});
