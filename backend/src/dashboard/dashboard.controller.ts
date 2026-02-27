import { Controller, Get, UseGuards, Request, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  getOverview(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.dashboardService.getOverview(req.user.userId, startDate, endDate);
  }

  @Get('category/:name')
  getCategoryTransactions(@Request() req, @Param('name') name: string) {
    return this.dashboardService.getCategoryTransactions(req.user.userId, name);
  }
}
