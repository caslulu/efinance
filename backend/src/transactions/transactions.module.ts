import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsScheduler } from './transactions.scheduler';
import { TransactionImpactService } from './transaction-impact.service';
import { StatementImportService } from './statement-import.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { ChatModule } from '../chat/chat.module';
import { AiStatementImportService } from './ai-statement-import.service';

@Module({
  imports: [PrismaModule, WalletsModule, ChatModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionsScheduler,
    TransactionImpactService,
    StatementImportService,
    AiStatementImportService,
  ],
  exports: [TransactionsService, TransactionImpactService],
})
export class TransactionsModule {}
