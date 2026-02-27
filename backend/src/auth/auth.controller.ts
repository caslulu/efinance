import { Controller, Post, Body, UseGuards, Request, Get, UnauthorizedException, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginTwoFactorDto } from './dto/login-2fa.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendTokenDto } from './dto/resend-token.dto';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Public } from './public.decorator';
import { Response } from 'express';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookie(res: Response, token: string, rememberMe = false) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearAuthCookie(res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req) {
    // Initiates the Google OAuth flow
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req, @Res() res) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
    
    if (req.user.isNewUser) {
       return res.redirect(`${frontendUrl}/register?email=${req.user.email}&username=${req.user.firstName}&googleToken=${req.user.registerToken}`);
    }

    const loginResult: any = await this.authService.login(req.user);
    
    if (loginResult.requires2FA) {
       res.redirect(`${frontendUrl}/login?userId=${loginResult.id}&requires2FA=true`);
    } else {
       this.setAuthCookie(res, loginResult.access_token, false);
       res.redirect(`${frontendUrl}/`);
    }
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const result: any = await this.authService.verifyEmail(dto.userId, dto.token);

    if (result?.access_token) {
      this.setAuthCookie(res, result.access_token, false);
    }

    return result;
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendTokenDto) {
    return this.authService.resendVerificationToken(dto.userId);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const result: any = await this.authService.login(user, !!loginDto.rememberMe);

    if (result?.access_token) {
      this.setAuthCookie(res, result.access_token, !!loginDto.rememberMe);
    }

    return result;
  }

  @Post('2fa/login')
  async login2fa(@Body() dto: LoginTwoFactorDto, @Res({ passthrough: true }) res: Response) {
    const result: any = await this.authService.login2fa(dto.userId, dto.token, !!dto.rememberMe);

    if (result?.access_token) {
      this.setAuthCookie(res, result.access_token, !!dto.rememberMe);
    }

    return result;
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookie(res);
    return { message: 'Logout efetuado com sucesso.' };
  }

  @Post('2fa/resend')
  async resend2fa(@Body() dto: ResendTokenDto) {
    return this.authService.resendToken(dto.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/enable')
  async enable2fa(@Request() req) {
    return this.authService.enableTwoFactor(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/disable')
  async disable2fa(@Request() req) {
    return this.authService.disableTwoFactor(req.user.userId);
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
  
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { 
      password, 
      twoFactorToken, 
      twoFactorTokenExpiry,
      resetToken,
      resetTokenExpiry,
      emailVerificationToken,
      emailVerificationTokenExpiry,
      ...result 
    } = user;
    return result;
  }
}
