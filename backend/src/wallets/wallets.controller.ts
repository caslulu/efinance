import { Controller, Post, Body, Param, Get, Patch, Delete, UseGuards, ParseIntPipe, Request } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { AddTransactionDto } from './dto/add-transaction.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('wallets')
@UseGuards(AuthGuard('jwt'))
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  create(@Request() req, @Body() createWalletDto: CreateWalletDto) {
    return this.walletsService.create(req.user.userId, createWalletDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.walletsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.walletsService.findOne(id, req.user.userId);
  }

  @Patch(':id/add-incoming')
  addIncoming(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() body: AddTransactionDto) {
    return this.walletsService.addIncoming(id, req.user.userId, body.amount);
  }

  @Patch(':id/add-expense')
  addExpense(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() body: AddTransactionDto) {
    return this.walletsService.addExpense(id, req.user.userId, body.amount);
  }

  @Patch(':id')
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateWalletDto: UpdateWalletDto) {
    return this.walletsService.update(id, req.user.userId, updateWalletDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.walletsService.remove(id, req.user.userId);
  }
}
