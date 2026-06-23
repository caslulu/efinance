import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionsScheduler {
  private readonly logger = new Logger(SubscriptionsScheduler.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Daily at 09:00 UTC (06:00 BRT). Catches all subscriptions whose
  // next_billing_date has arrived and generates the matching transactions.
  @Cron('0 9 * * *', { timeZone: 'UTC' })
  async dailyCheck() {
    try {
      const result = await this.subscriptionsService.triggerCheck();
      this.logger.log(
        `Subscriptions sync: ${result.processed} processed across ${result.details.length} cycle(s)`,
      );
    } catch (err) {
      this.logger.error('Subscriptions daily check failed', err as Error);
    }
  }
}
