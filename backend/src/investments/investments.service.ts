import { Injectable } from '@nestjs/common';
import { GetInvestmentMarketDataDto } from './dto/get-investment-market-data.dto';
import { InvestmentMarketDataService } from './investment-market-data.service';
import { InvestmentPortfolioService } from './investment-portfolio.service';
import { CreateInvestmentOperationDto } from './dto/create-investment-operation.dto';

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly investmentMarketDataService: InvestmentMarketDataService,
    private readonly investmentPortfolioService: InvestmentPortfolioService,
  ) {}

  getMarketData(query: GetInvestmentMarketDataDto) {
    return this.investmentMarketDataService.getMany({
      symbols: query.symbols,
      periods: query.periods,
      market: query.market,
    });
  }

  getPortfolio(userId: number) {
    return this.investmentPortfolioService.getPortfolio(userId);
  }

  createOperation(userId: number, dto: CreateInvestmentOperationDto) {
    return this.investmentPortfolioService.createOperation(userId, dto);
  }
}
