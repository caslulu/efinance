import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { randomBytes } from 'crypto';

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
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, rememberMe = false) {
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
