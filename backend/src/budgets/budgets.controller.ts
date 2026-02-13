import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('budgets')
@UseGuards(AuthGuard('jwt'))
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(@Request() req) {
    return this.budgetsService.findAll(req.user.userId);
  }

  @Get('status')
  getStatus(@Request() req) {
    return this.budgetsService.getBudgetStatus(req.user.userId);
  }

  @Post()
  upsert(@Request() req, @Body() body: { category_id: number; limit: number }) {
    return this.budgetsService.upsert(req.user.userId, body.category_id, body.limit);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.remove(req.user.userId, id);
  }
}
