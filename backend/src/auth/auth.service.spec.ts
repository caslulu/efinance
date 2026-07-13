import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { ServiceUnavailableException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockUsersService = {
  findByUsername: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  updatePendingRegistration: jest.fn(),
  setEmailVerificationToken: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(() => 'mockToken'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
};

const mockMailerService = {
  sendMail: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        MAIL_HOST: 'smtp.gmail.com',
        MAIL_USER: 'app@gmail.com',
        MAIL_PASS: 'app-password',
      };
      return values[key];
    });

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
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data if validation succeeds', async () => {
      const mockUser = {
        id: 1,
        username: 'test',
        password: 'hashedPassword',
      };

      jest
        .spyOn(mockUsersService, 'findByUsername')
        .mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test', 'password');
      expect(result).toEqual(mockUser);
    });

    it('should return null if validation fails', async () => {
      jest.spyOn(mockUsersService, 'findByUsername').mockResolvedValue(null);
      const result = await service.validateUser('test', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return an access token', async () => {
      const result = await service.login({
        username: 'test',
        id: 1,
        isEmailVerified: true,
      });
      expect(result).toEqual({ access_token: 'mockToken' });
    });

    it('should include verification recovery data when email is not verified', async () => {
      await expect(
        service.login({
          username: 'test',
          email: 'test@example.com',
          id: 1,
          isEmailVerified: false,
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'EMAIL_NOT_VERIFIED',
          requiresEmailVerification: true,
          userId: 1,
          email: 'test@example.com',
        },
      });
    });
  });

  describe('register', () => {
    it('should reuse an unverified account and return email verification data', async () => {
      const existingUser = {
        id: 1,
        username: 'test',
        email: 'test@example.com',
        isEmailVerified: false,
      };
      const updatedUser = { ...existingUser, username: 'newtest' };

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUsersService.findByEmail.mockResolvedValue(existingUser);
      mockUsersService.updatePendingRegistration.mockResolvedValue(updatedUser);
      mockUsersService.setEmailVerificationToken.mockResolvedValue(updatedUser);
      mockMailerService.sendMail.mockResolvedValue(undefined);

      const result = await service.register({
        username: 'newtest',
        email: 'test@example.com',
        password: 'Password1',
      });

      expect(mockUsersService.create).not.toHaveBeenCalled();
      expect(mockUsersService.updatePendingRegistration).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          username: 'newtest',
          email: 'test@example.com',
          password: 'hashedPassword',
        }),
      );
      expect(result).toEqual({
        message:
          'Cadastro pendente encontrado. Enviamos um novo código de verificação.',
        requiresEmailVerification: true,
        userId: 1,
        email: 'test@example.com',
      });
    });

    it('should reject instead of reporting success when Gmail rejects the email', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 2,
        username: 'new-user',
        email: 'new@example.com',
        isEmailVerified: false,
      });
      mockMailerService.sendMail.mockRejectedValue(new Error('SMTP rejected'));

      await expect(
        service.register({
          username: 'new-user',
          email: 'new@example.com',
          password: 'Password1',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('should reject clearly without attempting SMTP when mail is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({
        id: 3,
        username: 'new-user',
        email: 'new@example.com',
        isEmailVerified: false,
      });

      await expect(
        service.register({
          username: 'new-user',
          email: 'new@example.com',
          password: 'Password1',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });
  });
});
