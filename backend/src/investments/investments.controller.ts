import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InvestmentsService } from './investments.service';
import { GetInvestmentMarketDataDto } from './dto/get-investment-market-data.dto';
import { CreateInvestmentOperationDto } from './dto/create-investment-operation.dto';

@Controller('investments')
@UseGuards(AuthGuard('jwt'))
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get('portfolio')
  getPortfolio(@Request() req) {
    return this.investmentsService.getPortfolio(req.user.userId);
  }

  @Get('market-data')
  getMarketData(@Query() query: GetInvestmentMarketDataDto) {
    return this.investmentsService.getMarketData(query);
  }

  @Post('operations')
  createOperation(@Request() req, @Body() body: CreateInvestmentOperationDto) {
    return this.investmentsService.createOperation(req.user.userId, body);
  }
}
