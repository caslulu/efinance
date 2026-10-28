import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin wrapper around Ollama's HTTP API (native /api/chat endpoint).
 * Works with Ollama Cloud (https://ollama.com) when an API key is provided,
 * or with a self-hosted Ollama (e.g. http://localhost:11434) when there's no key.
 *
 * The public surface mirrors the previous GeminiService so the rest of the
 * chat module didn't need to change.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('OLLAMA_BASE_URL') ?? 'https://ollama.com'
    ).replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('OLLAMA_API_KEY');
    this.model =
      this.configService.get<string>('OLLAMA_MODEL') ?? 'gpt-oss:20b';

    // Explicit self-hosted endpoints may use Docker DNS or a LAN address.
    let isSelfHosted = false;
    try {
      const url = new URL(this.baseUrl);
      isSelfHosted =
        ['http:', 'https:'].includes(url.protocol) &&
        !['ollama.com', 'www.ollama.com'].includes(url.hostname);
    } catch {
      /* Report missing/invalid configuration when the feature is used. */
    }
    this.configured = Boolean(this.apiKey || isSelfHosted);
    if (!this.configured) {
      this.logger.warn(
        'Configure OLLAMA_API_KEY or a valid self-hosted OLLAMA_BASE_URL to enable AI features',
      );
    }
  }

  private ensureConfigured() {
    if (!this.configured) {
      throw new Error(
        'Assistente IA indisponível: configure OLLAMA_API_KEY (ou aponte OLLAMA_BASE_URL para um servidor local)',
      );
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async generateJsonResponse(
    systemPrompt: string,
    userMessage: string,
  ): Promise<unknown> {
    try {
      this.ensureConfigured();
    } catch {
      throw new ServiceUnavailableException(
        'Análise por IA indisponível. Configure OLLAMA_API_KEY ou OLLAMA_BASE_URL no backend. A importação convencional continua disponível.',
      );
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          model: this.model,
          messages: this.buildMessages(systemPrompt, [], userMessage),
          stream: false,
          // Ollama Cloud does not support constrained structured outputs.
          ...(new URL(this.baseUrl).hostname === 'ollama.com'
            ? {}
            : { format: 'json' }),
          options: { temperature: 0, num_ctx: 65536, num_predict: 16000 },
        }),
      });
      if (!res.ok) throw new Error('Provider request failed');
      const data = (await res.json()) as {
        message?: { content?: string };
        done_reason?: string;
      };
      if (data.done_reason === 'length') throw new Error('Truncated response');
      const content = data.message?.content
        ?.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      if (!content) throw new Error('Empty response');
      return JSON.parse(content) as unknown;
    } catch {
      // Never expose provider bodies, credentials, or financial content in errors.
      throw new BadGatewayException(
        'Não foi possível concluir a análise por IA. Tente novamente ou divida o documento em arquivos menores.',
      );
    }
  }

  private buildMessages(
    systemPrompt: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[],
    userMessage: string,
  ) {
    return [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map((m) => ({
        // Ollama uses 'assistant' instead of 'model'
        role: m.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];
  }

  async generateResponse(
    systemPrompt: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[],
    userMessage: string,
  ): Promise<string> {
    this.ensureConfigured();
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(
          systemPrompt,
          conversationHistory,
          userMessage,
        ),
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama API error ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? '';
  }

  async *generateResponseStream(
    systemPrompt: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[],
    userMessage: string,
  ): AsyncGenerator<string> {
    this.ensureConfigured();
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        model: this.model,
        messages: this.buildMessages(
          systemPrompt,
          conversationHistory,
          userMessage,
        ),
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const body = res.body ? await res.text() : '<no body>';
      throw new Error(`Ollama API error ${res.status}: ${body}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Ollama streams NDJSON — one JSON object per line.
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
          };
          const chunk = parsed.message?.content;
          if (chunk) yield chunk;
          if (parsed.done) return;
        } catch {
          // Skip malformed chunks — Ollama can split JSON across reads.
        }
      }
    }
  }

  async generateTitle(
    userMessage: string,
    assistantResponse: string,
  ): Promise<string> {
    const prompt = `Baseado nesta conversa, gere um título curto (máximo 5 palavras) em português para ela. Responda APENAS com o título, sem aspas ou pontuação extra.\n\nUsuário: ${userMessage}\nAssistente: ${assistantResponse.substring(0, 200)}`;
    const text = await this.generateResponse(
      'Você gera títulos curtos para conversas.',
      [],
      prompt,
    );
    return text.trim().replace(/^["']|["']$/g, '');
  }
}
