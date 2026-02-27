import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MailerModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
