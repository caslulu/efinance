import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService } from './gemini.service';
import { ChatContextService } from './chat-context.service';
import { CreateMessageDto } from './dto/create-message.dto';

const SYSTEM_PROMPT = `Você é um consultor financeiro pessoal inteligente integrado ao FinanceApp. Você tem acesso aos dados financeiros reais do usuário e deve usá-los para dar respostas personalizadas e precisas.

Suas especialidades:
- Análise de gastos e orçamento
- Avaliação de compras (vale a pena comprar agora?)
- Insights sobre investimentos e patrimônio
- Identificação de oportunidades de economia
- Análise de saúde financeira geral
- Comparação de preços da lista de desejos

Regras:
1. Sempre responda em Português do Brasil
2. Seja direto e objetivo, mas amigável
3. Baseie suas recomendações nos dados reais do usuário
4. Use formatação Markdown quando necessário (listas, negrito, tabelas)
5. Quando falar sobre valores, use o formato R$ X.XXX,XX
6. Não invente dados que não estão no contexto fornecido
7. Se não tiver dados suficientes para responder, diga isso claramente
8. Não dê conselhos de investimento regulamentados (não é recomendação formal)
9. Considere a situação financeira completa do usuário antes de recomendar qualquer compra ou investimento

Dados financeiros atuais do usuário:
`;

const DAILY_QUESTION_LIMIT = 15;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly chatContextService: ChatContextService,
  ) {}

  async sendMessage(userId: number, dto: CreateMessageDto) {
    await this.reserveDailyQuestionSlot(userId);

    // Get or create conversation
    let conversation;
    if (dto.conversationId) {
      conversation = await this.prisma.chatConversation.findFirst({
        where: { id: dto.conversationId, user_id: userId },
        include: { messages: { orderBy: { created_at: 'asc' } } },
      });
      if (!conversation) throw new NotFoundException('Conversa não encontrada');
    } else {
      conversation = await this.prisma.chatConversation.create({
        data: { user_id: userId },
        include: { messages: true },
      });
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        role: 'USER',
        content: dto.message,
      },
    });

    // Build financial context
    const financialContext = await this.chatContextService.buildFinancialContext(userId);
    const systemPrompt = SYSTEM_PROMPT + financialContext;

    // Build conversation history for Gemini
    const history = conversation.messages.map((msg) => ({
      role: msg.role === 'USER' ? 'user' as const : 'model' as const,
      content: msg.content,
    }));

    // Generate AI response
    const aiResponse = await this.geminiService.generateResponse(
      systemPrompt,
      history,
      dto.message,
    );

    // Save AI response
    await this.prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        role: 'ASSISTANT',
        content: aiResponse,
      },
    });

    // Update conversation timestamp
    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { updated_at: new Date() },
    });

    // Auto-generate title for new conversations
    if (!dto.conversationId || !conversation.title) {
      this.generateAndSaveTitle(conversation.id, dto.message, aiResponse).catch(() => {});
    }

    return {
      conversationId: conversation.id,
      message: aiResponse,
    };
  }

  async *sendMessageStream(userId: number, dto: CreateMessageDto) {
    await this.reserveDailyQuestionSlot(userId);

    // Get or create conversation
    let conversation;
    if (dto.conversationId) {
      conversation = await this.prisma.chatConversation.findFirst({
        where: { id: dto.conversationId, user_id: userId },
        include: { messages: { orderBy: { created_at: 'asc' } } },
      });
      if (!conversation) throw new NotFoundException('Conversa não encontrada');
    } else {
      conversation = await this.prisma.chatConversation.create({
        data: { user_id: userId },
        include: { messages: true },
      });
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        role: 'USER',
        content: dto.message,
      },
    });

    // Build financial context
    const financialContext = await this.chatContextService.buildFinancialContext(userId);
    const systemPrompt = SYSTEM_PROMPT + financialContext;

    // Build conversation history
    const history = conversation.messages.map((msg) => ({
      role: msg.role === 'USER' ? 'user' as const : 'model' as const,
      content: msg.content,
    }));

    // Yield conversation ID first
    yield JSON.stringify({ type: 'meta', conversationId: conversation.id });

    // Stream AI response
    let fullResponse = '';
    for await (const chunk of this.geminiService.generateResponseStream(
      systemPrompt,
      history,
      dto.message,
    )) {
      fullResponse += chunk;
      yield JSON.stringify({ type: 'chunk', content: chunk });
    }

    // Save full response
    await this.prisma.chatMessage.create({
      data: {
        conversation_id: conversation.id,
        role: 'ASSISTANT',
        content: fullResponse,
      },
    });

    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { updated_at: new Date() },
    });

    // Auto-generate title
    if (!dto.conversationId || !conversation.title) {
      this.generateAndSaveTitle(conversation.id, dto.message, fullResponse).catch(() => {});
    }

    yield JSON.stringify({ type: 'done' });
  }

  async getConversations(userId: number) {
    return this.prisma.chatConversation.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { content: true, role: true, created_at: true },
        },
      },
    });
  }

  async getConversation(userId: number, conversationId: number) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, user_id: userId },
      include: {
        messages: { orderBy: { created_at: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }

  async deleteConversation(userId: number, conversationId: number) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, user_id: userId },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');

    await this.prisma.chatConversation.delete({
      where: { id: conversationId },
    });

    return { deleted: true };
  }

  private async generateAndSaveTitle(conversationId: number, userMessage: string, aiResponse: string) {
    const title = await this.geminiService.generateTitle(userMessage, aiResponse);
    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  private async reserveDailyQuestionSlot(userId: number) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const incrementResult = await this.prisma.chatDailyUsage.updateMany({
      where: {
        user_id: userId,
        usage_date: startOfDay,
        questions_count: { lt: DAILY_QUESTION_LIMIT },
      },
      data: {
        questions_count: {
          increment: 1,
        },
      },
    });

    if (incrementResult.count === 1) return;

    try {
      await this.prisma.chatDailyUsage.create({
        data: {
          user_id: userId,
          usage_date: startOfDay,
          questions_count: 1,
        },
      });
      return;
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';

      if (!isUniqueViolation) {
        throw error;
      }
    }

    const retryIncrementResult = await this.prisma.chatDailyUsage.updateMany({
      where: {
        user_id: userId,
        usage_date: startOfDay,
        questions_count: { lt: DAILY_QUESTION_LIMIT },
      },
      data: {
        questions_count: {
          increment: 1,
        },
      },
    });

    if (retryIncrementResult.count === 0) {
      throw new HttpException(
        `Você atingiu o limite diário de ${DAILY_QUESTION_LIMIT} perguntas para o assistente AI. Tente novamente amanhã.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
