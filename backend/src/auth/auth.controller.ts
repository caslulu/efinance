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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req) {
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req, @Res() res) {
    const loginResult = await this.authService.login(req.user);
    
    if (loginResult.requires2FA) {
    } else {
    }
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.userId, dto.token);
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendTokenDto) {
    return this.authService.resendVerificationToken(dto.userId);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user, !!loginDto.rememberMe);
  }

  @Post('2fa/login')
  async login2fa(@Body() dto: LoginTwoFactorDto) {
    return this.authService.login2fa(dto.userId, dto.token, !!dto.rememberMe);
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
    const { password, twoFactorToken, ...result } = user;
    return result;
  }
}