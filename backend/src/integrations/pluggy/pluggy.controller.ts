import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PluggyService } from './pluggy.service';

@Controller('integrations/pluggy')
@UseGuards(AuthGuard('jwt'))
export class PluggyController {
  constructor(private readonly pluggy: PluggyService) {}

  @Get('status')
  status() {
    return { enabled: this.pluggy.isEnabled() };
  }

  @Post('sync')
  async sync() {
    if (!this.pluggy.isEnabled()) {
      throw new BadRequestException('Pluggy integration is not configured');
    }
    return this.pluggy.syncAll();
  }
}
