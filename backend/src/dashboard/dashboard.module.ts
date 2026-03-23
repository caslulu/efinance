import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BudgetsModule } from '../budgets/budgets.module';
import { InvestmentsModule } from '../investments/investments.module';

@Module({
  imports: [BudgetsModule, InvestmentsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
