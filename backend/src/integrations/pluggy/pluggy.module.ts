import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PluggyController } from './pluggy.controller';
import { PluggyScheduler } from './pluggy.scheduler';
import { PluggyService } from './pluggy.service';

@Module({
  imports: [PrismaModule],
  controllers: [PluggyController],
  providers: [PluggyService, PluggyScheduler],
  exports: [PluggyService],
})
export class PluggyModule {}
