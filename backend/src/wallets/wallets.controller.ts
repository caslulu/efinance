import { Controller, Post, Body, Param, Get, Patch, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
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
  create(@Body() createWalletDto: CreateWalletDto) {
    return this.walletsService.create(createWalletDto);
  }

  @Get()
  findAll() {
    return this.walletsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.walletsService.findOne(id);
  }

  @Patch(':id/add-incoming')
  addIncoming(@Param('id', ParseIntPipe) id: number, @Body() body: AddTransactionDto) {
    return this.walletsService.addIncoming(id, body.amount);
  }

  @Patch(':id/add-expense')
  addExpense(@Param('id', ParseIntPipe) id: number, @Body() body: AddTransactionDto) {
    return this.walletsService.addExpense(id, body.amount);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateWalletDto: UpdateWalletDto) {
    return this.walletsService.update(id, updateWalletDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.walletsService.remove(id);
  }
}
