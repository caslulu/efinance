import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatContextService } from './chat-context.service';
import { LlmService } from './llm.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChatController],
  providers: [ChatService, ChatContextService, LlmService],
  exports: [LlmService],
})
export class ChatModule {}
