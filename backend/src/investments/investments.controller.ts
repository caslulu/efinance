import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvestmentsService } from './investments.service';
import { GetInvestmentMarketDataDto } from './dto/get-investment-market-data.dto';

@Controller('investments')
@UseGuards(AuthGuard('jwt'))
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get('market-data')
  getMarketData(@Query() query: GetInvestmentMarketDataDto) {
    return this.investmentsService.getMarketData(query);
  }
}
