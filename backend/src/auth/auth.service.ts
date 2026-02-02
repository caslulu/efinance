import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { randomBytes } from 'crypto';
import { toDataURL } from 'qrcode';

const { authenticator } = require('otplib');

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: any, rememberMe = false) {
    if (user.isTwoFactorEnabled) {
      return {
        requires2FA: true,
        username: user.username,
        id: user.id
      };
    }

    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: rememberMe ? '7d' : '60m',
      }),
    };
  }

  async login2fa(userId: number, token: string, rememberMe = false) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = authenticator.check(token, user.twoFactorSecret);

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: rememberMe ? '7d' : '60m',
      }),
    };
  }

  async register(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    return this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByUsername(email);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const resetToken = randomBytes(32).toString('hex');

    await this.usersService.setResetToken(user.id, resetToken, resetTokenExpiry);
    
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Recuperação de Senha - FinanceApp',
        html: `
          <h3>Recuperação de Senha</h3>
          <p>Você solicitou a redefinição de sua senha.</p>
          <p>Clique no link abaixo para criar uma nova senha:</p>
          <a href="${resetLink}">Redefinir Senha</a>
          <p>Este link expira em 1 hora.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      console.log(`[DEV FALLBACK] Reset Link: ${resetLink}`);
    }

    return { message: 'Se o email existir, um link de recuperação foi enviado.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);
    if (!user) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: 'Senha alterada com sucesso.' };
  }

  async generateTwoFactorSecret(userId: number, email: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'FinanceApp', secret);
    await this.usersService.updateTwoFactorSecret(userId, secret);
    return {
      secret,
      otpauthUrl,
      qrCode: await toDataURL(otpauthUrl),
    };
  }

  async enableTwoFactor(userId: number, token: string) {
    const user = await this.usersService.findOne(userId);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not started');
    }
    const isValid = authenticator.check(token, user.twoFactorSecret);
    if (!isValid) throw new BadRequestException('Invalid token');
    await this.usersService.enableTwoFactor(userId);
    return { message: '2FA enabled successfully' };
  }

  async disableTwoFactor(userId: number) {
    await this.usersService.disableTwoFactor(userId);
    return { message: '2FA disabled successfully' };
  }
}