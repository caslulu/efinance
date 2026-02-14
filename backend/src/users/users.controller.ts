import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req) {
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
