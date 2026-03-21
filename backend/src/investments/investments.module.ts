import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { InvestmentMarketDataService } from './investment-market-data.service';

@Module({
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentMarketDataService],
})
export class InvestmentsModule {}
