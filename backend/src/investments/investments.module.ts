import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentsController } from './investments.controller';
import { InvestmentMarketDataService } from './investment-market-data.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InvestmentPortfolioService } from './investment-portfolio.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvestmentsController],
  providers: [
    InvestmentsService,
    InvestmentMarketDataService,
    InvestmentPortfolioService,
  ],
  exports: [InvestmentPortfolioService, InvestmentMarketDataService],
})
export class InvestmentsModule {}
