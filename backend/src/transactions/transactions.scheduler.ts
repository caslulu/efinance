import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionsService } from './transactions.service';

@Injectable()
export class TransactionsScheduler {
  private readonly logger = new Logger(TransactionsScheduler.name);

  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Runs every day at midnight to process matured future transactions.
   * Applies wallet balance impact for transactions whose date has arrived.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleMaturedTransactions() {
    this.logger.log('Processing matured future transactions...');
    const count = await this.transactionsService.processMaturedTransactions();
    this.logger.log(`Processed ${count} matured transaction(s).`);
  }
}
