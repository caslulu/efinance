import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  Res,
  ParseIntPipe,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async sendMessage(@Request() req, @Body() dto: CreateMessageDto) {
    return this.chatService.sendMessage(req.user.userId, dto);
  }

  @Post('messages/stream')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async sendMessageStream(
    @Request() req,
    @Body() dto: CreateMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const data of this.chatService.sendMessageStream(
        req.user.userId,
        dto,
      )) {
        res.write(`data: ${data}\n\n`);
      }
    } catch (error: unknown) {
      const isDailyLimitError =
        error instanceof HttpException &&
        error.getStatus() === 429;

      const errorResponse =
        isDailyLimitError && error instanceof HttpException
          ? error.getResponse()
          : null;

      const dailyLimitMessage =
        typeof errorResponse === 'object' &&
        errorResponse !== null &&
        'message' in errorResponse &&
        typeof errorResponse.message === 'string'
          ? errorResponse.message
          : 'Limite diário atingido';

      const message =
        isDailyLimitError ? dailyLimitMessage : 'Erro ao gerar resposta';

      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Get('conversations')
  getConversations(@Request() req) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Get('conversations/:id')
  getConversation(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.getConversation(req.user.userId, id);
  }

  @Delete('conversations/:id')
  deleteConversation(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.deleteConversation(req.user.userId, id);
  }
}
