import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PluggyService } from './pluggy.service';

@Controller('integrations/pluggy')
@UseGuards(AuthGuard('jwt'))
export class PluggyController {
  constructor(private readonly pluggy: PluggyService) {}

  @Get('status')
  async status(@Request() req) {
    const enabledForUser = await this.pluggy.isEnabledForUser(req.user.userId);
    return {
      configured: this.pluggy.isConfigured(),
      enabledForUser,
    };
  }

  @Post('enable')
  enable(@Request() req) {
    if (!this.pluggy.isConfigured()) {
      throw new BadRequestException(
        'Pluggy credentials not configured on the server',
      );
    }
    return this.pluggy.enableForUser(req.user.userId);
  }

  @Post('disable')
  disable(@Request() req) {
    return this.pluggy.disableForUser(req.user.userId);
  }

  @Post('sync')
  async sync() {
    if (!this.pluggy.isConfigured()) {
      throw new BadRequestException(
        'Pluggy credentials not configured on the server',
      );
    }
    return this.pluggy.syncAll();
  }
}
