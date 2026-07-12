import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('subscriptions')
@UseGuards(AuthGuard('jwt'))
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  create(@Request() req, @Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(
      req.user.userId,
      createSubscriptionDto,
    );
  }

  @Post('trigger')
  triggerCheck(@Request() req) {
    return this.subscriptionsService.triggerCheck(req.user.userId);
  }

  @Get()
  findAll(@Request() req) {
    return this.subscriptionsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(
      id,
      req.user.userId,
      updateSubscriptionDto,
    );
  }

  @Patch(':id/pause')
  pause(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.pause(id, req.user.userId);
  }

  @Patch(':id/resume')
  resume(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.resume(id, req.user.userId);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.subscriptionsService.remove(id, req.user.userId);
  }
}
