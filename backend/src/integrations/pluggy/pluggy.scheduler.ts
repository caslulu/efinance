import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PluggyService } from './pluggy.service';

@Injectable()
export class PluggyScheduler {
  private readonly logger = new Logger(PluggyScheduler.name);

  constructor(private readonly pluggy: PluggyService) {}

  // Daily at 06:00 BRT (09:00 UTC). MeuPluggy refreshes data once per day.
  @Cron('0 9 * * *', { timeZone: 'UTC' })
  async dailySync() {
    if (!this.pluggy.isConfigured()) {
      this.logger.debug('Pluggy credentials missing — skipping daily sync');
      return;
    }
    try {
      const result = await this.pluggy.syncAll();
      this.logger.log(
        `Pluggy sync: ${result.inserted} inserted, ${result.skipped} skipped across ${result.accounts} account(s)`,
      );
    } catch (err) {
      this.logger.error('Pluggy daily sync failed', err as Error);
    }
  }
}
