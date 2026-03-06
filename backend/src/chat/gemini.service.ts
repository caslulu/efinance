import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      console.warn('GEMINI_API_KEY is not configured — chat module will be unavailable');
    }
  }

  private ensureConfigured() {
    if (!this.genAI) {
      throw new Error('Assistente IA indisponível: GEMINI_API_KEY não configurada');
    }
    return this.genAI;
  }

  async generateResponse(
    systemPrompt: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[],
    userMessage: string,
  ): Promise<string> {
    const genAI = this.ensureConfigured();
    const model = genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
    });

    const history: Content[] = conversationHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  }

  async *generateResponseStream(
    systemPrompt: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[],
    userMessage: string,
  ): AsyncGenerator<string> {
    const genAI = this.ensureConfigured();
    const model = genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemPrompt,
    });

    const history: Content[] = conversationHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(userMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  async generateTitle(userMessage: string, assistantResponse: string): Promise<string> {
    const genAI = this.ensureConfigured();
    const model = genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent(
      `Baseado nesta conversa, gere um título curto (máximo 5 palavras) em português para ela. Responda APENAS com o título, sem aspas ou pontuação extra.\n\nUsuário: ${userMessage}\nAssistente: ${assistantResponse.substring(0, 200)}`,
    );
    return result.response.text().trim();
  }
}
