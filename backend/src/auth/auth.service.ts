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

  generateRegisterToken(profile: any) {
    const payload = { 
      email: profile.email, 
      firstName: profile.firstName,
      isGoogleVerified: true 
    };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  async validateGoogleUser(googleUser: any) {
    let user = await this.usersService.findByUsername(googleUser.email);
    if (!user) {
      // Return temporary token for registration completion
      const registerToken = this.generateRegisterToken(googleUser);
      return { 
        isNewUser: true, 
        registerToken,
        email: googleUser.email,
        firstName: googleUser.firstName 
      };
    }
    return user;
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: any, rememberMe = false) {
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email não verificado. Por favor, verifique seu email antes de logar.');
    }

    if (user.isTwoFactorEnabled) {
      this.sendTwoFactorToken(user).catch(err => console.error('Failed to send 2FA email asynchronously', err));
      return {
        requires2FA: true,
        username: user.username,
        id: user.id
      };
    }

    return this.generateJwt(user, rememberMe);
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

  async register(createUserDto: CreateUserDto) {
    let isVerified = false;

    if (createUserDto.registerToken) {
      try {
        const payload = this.jwtService.verify(createUserDto.registerToken);
        if (payload.email === createUserDto.email && payload.isGoogleVerified) {
          isVerified = true;
        }
      } catch (e) {
        console.warn('Invalid registerToken provided');
      }
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });

    if (isVerified) {
      await this.usersService.markEmailAsVerified(user.id);
    } else {
      this.sendVerificationEmail(user).catch(err => console.error('Failed to send verification email asynchronously', err));
    }

    return {
      message: isVerified ? 'Cadastro realizado com sucesso.' : 'Cadastro realizado. Verifique seu email.',
      requiresEmailVerification: !isVerified,
      userId: user.id,
      email: user.email
    };
  }

  async verifyEmail(userId: number, token: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.isEmailVerified) {
      return { message: 'Email já verificado.', verified: true };
    }

    if (user.emailVerificationToken !== token) {
      throw new BadRequestException('Código de verificação inválido.');
    }

    if (user.emailVerificationTokenExpiry && new Date() > user.emailVerificationTokenExpiry) {
      throw new BadRequestException('Código expirado.');
    }

    await this.usersService.markEmailAsVerified(userId);
    return this.generateJwt(user, false);
  }

  async resendVerificationToken(userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.isEmailVerified) throw new BadRequestException('Email já verificado.');

    await this.sendVerificationEmail(user);
    return { message: 'Novo código de verificação enviado.' };
  }

  async resendToken(userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');
    
    await this.sendTwoFactorToken(user);
    return { message: 'Novo código enviado.' };
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

  async enableTwoFactor(userId: number) {
    await this.usersService.enableTwoFactor(userId);
    return { message: 'Autenticação de dois fatores ativada.' };
  }

  async disableTwoFactor(userId: number) {
    await this.usersService.disableTwoFactor(userId);
    return { message: 'Autenticação de dois fatores desativada.' };
  }

  private generateJwt(user: any, rememberMe: boolean) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: rememberMe ? '7d' : '60m',
      }),
    };
  }

  private async sendTwoFactorToken(user: any) {
    const token = randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

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

  private async sendVerificationEmail(user: any) {
    const token = randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.setEmailVerificationToken(user.id, token, expiry);

    try {
      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Bem-vindo ao FinanceApp - Verifique seu email',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0;">Bem-vindo ao FinanceApp!</h1>
            </div>
            <div style="padding: 20px;">
              <p style="font-size: 16px;">Olá, <strong>${user.username}</strong>!</p>
              <p style="font-size: 16px;">Estamos muito felizes em tê-lo conosco. Para garantir a segurança da sua conta e começar a usar o FinanceApp, por favor, utilize o código abaixo para verificar seu email:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background-color: #f0f7ff; padding: 15px 25px; border-radius: 8px; display: inline-block;">${token}</div>
              </div>
              
              <p style="font-size: 14px; color: #666;">Este código é válido por 24 horas.</p>
              <p style="font-size: 14px; color: #666;">Se você não criou esta conta, por favor ignore este email.</p>
            </div>
            <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #999;">
              &copy; ${new Date().getFullYear()} FinanceApp. Todos os direitos reservados.
            </div>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      console.log(`[DEV FALLBACK] Verification Token: ${token}`);
    }
  }
}