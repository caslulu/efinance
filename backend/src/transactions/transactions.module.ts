import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsScheduler } from './transactions.scheduler';
import { TransactionImpactService } from './transaction-impact.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [PrismaModule, WalletsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsScheduler, TransactionImpactService],
  exports: [TransactionsService, TransactionImpactService],
})
export class TransactionsModule {}
