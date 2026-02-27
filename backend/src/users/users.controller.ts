import { Controller, Get, Patch, Body, UseGuards, Request, BadRequestException, Post, UseInterceptors, UploadedFile, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ConfigService } from '@nestjs/config';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) { }

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

  @Patch('profile')
  async updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    try {
      return await this.usersService.update(req.user.userId, updateUserDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
        return cb(new BadRequestException('Somente arquivos de imagem são permitidos.'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 2 * 1024 * 1024 // 2MB
    }
  }))
  async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo não enviado ou inválido.');
    }

    const baseUrl = this.configService.get('BACKEND_URL') || 'http://localhost:3000';
    const avatarUrl = `${baseUrl}/uploads/avatars/${file.filename}`;

    await this.usersService.update(req.user.userId, { avatarUrl });

    return { avatarUrl };
  }

  @Delete('profile')
  async deleteProfile(@Request() req) {
    try {
      await this.usersService.removeProfile(req.user.userId);
      return { message: 'Account successfully deleted' };
    } catch (error) {
      throw new BadRequestException('Erro ao excluir conta: ' + error.message);
    }
  }
}
