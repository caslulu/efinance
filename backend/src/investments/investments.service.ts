import { Injectable } from '@nestjs/common';
import { GetInvestmentMarketDataDto } from './dto/get-investment-market-data.dto';
import { InvestmentMarketDataService } from './investment-market-data.service';

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly investmentMarketDataService: InvestmentMarketDataService,
  ) {}

  getMarketData(query: GetInvestmentMarketDataDto) {
    return this.investmentMarketDataService.getMany({
      symbols: query.symbols,
      periods: query.periods,
      market: query.market,
    });
  }
}
