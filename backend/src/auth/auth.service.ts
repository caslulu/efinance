import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

    await this.usersService.setResetToken(user.id, resetToken, resetTokenExpiry);

    console.log(`[EMAIL SIMULATION] Reset Link for ${email}: ${resetLink}`);

    return { message: 'Email de recuperação enviado (simulado no console do servidor).' };
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
