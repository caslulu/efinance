import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('cards')
@UseGuards(AuthGuard('jwt'))
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  create(@Request() req, @Body() createCardDto: CreateCardDto) {
    return this.cardsService.create(req.user.userId, createCardDto);
  }

  @Get('wallet/:walletId')
  findAllByWallet(
    @Request() req,
    @Param('walletId', ParseIntPipe) walletId: number,
  ) {
    return this.cardsService.findAllByWallet(walletId, req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.cardsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardsService.update(id, req.user.userId, updateCardDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.cardsService.remove(id, req.user.userId);
  }
}
