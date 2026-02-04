import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { randomBytes, randomInt } from 'crypto';

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
      // Send in background to allow immediate UI redirect
      this.sendTwoFactorToken(user).catch(err => console.error('Failed to send 2FA email asynchronously', err));
      return {
        requires2FA: true,
        username: user.username,
        id: user.id
      };
    }

    return this.generateJwt(user, rememberMe);
  }

  async resendToken(userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');
    
    // We don't need to check expiry for resend, just generate a new one
    await this.sendTwoFactorToken(user);
    return { message: 'Novo código enviado.' };
  }

  async login2fa(userId: number, token: string, rememberMe = false) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.twoFactorToken || !user.twoFactorTokenExpiry) {
      throw new UnauthorizedException('Nenhum código de verificação pendente.');
    }

    if (new Date() > user.twoFactorTokenExpiry) {
      throw new UnauthorizedException('O código expirou. Faça login novamente.');
    }

    if (user.twoFactorToken !== token) {
      throw new UnauthorizedException('Código incorreto.');
    }

    await this.usersService.setTwoFactorToken(userId, null, null);

    return this.generateJwt(user, rememberMe);
  }

  private generateJwt(user: any, rememberMe: boolean) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: rememberMe ? '7d' : '60m',
      }),
    };
  }

  async sendTwoFactorToken(user: any) {
    const token = randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.usersService.setTwoFactorToken(user.id, token, expiry);

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Código de Verificação - FinanceApp',
        html: `
          <h3>Seu código de acesso</h3>
          <p>Utilize o código abaixo para completar seu login:</p>
          <h2 style="letter-spacing: 5px; background: #f0f0f0; padding: 10px; display: inline-block;">${token}</h2>
          <p>Este código expira em 10 minutos.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send 2FA email:', error);
      console.log(`[DEV FALLBACK] 2FA Token: ${token}`);
    }
  }

  async enableTwoFactor(userId: number) {
    await this.usersService.enableTwoFactor(userId);
    return { message: 'Autenticação de dois fatores ativada.' };
  }

  async disableTwoFactor(userId: number) {
    await this.usersService.disableTwoFactor(userId);
    return { message: 'Autenticação de dois fatores desativada.' };
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
    const resetTokenExpiry = new Date(Date.now() + 3600000);
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

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
}