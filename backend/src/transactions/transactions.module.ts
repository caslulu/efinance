import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsScheduler } from './transactions.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsScheduler],
  exports: [TransactionsService],
})
export class TransactionsModule {}
