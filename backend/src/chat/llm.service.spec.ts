import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';

describe('LlmService JSON extraction', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >();
  function requestBody() {
    return JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      format?: string;
    };
  }
  function service(settings: Record<string, string>) {
    return new LlmService({
      get: (key: string) => settings[key],
    } as ConfigService);
  }
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: { content: '{"rows":[]}' },
          done_reason: 'stop',
        }),
      ),
    );
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('supports self-hosted Docker hosts without an API key', async () => {
    await expect(
      service({ OLLAMA_BASE_URL: 'http://ollama:11434' }).generateJsonResponse(
        'rules',
        'source',
      ),
    ).resolves.toEqual({ rows: [] });
    expect(requestBody().format).toBe('json');
  });

  it('does not send unsupported structured-output options to Ollama Cloud', async () => {
    await service({ OLLAMA_API_KEY: 'test-key' }).generateJsonResponse(
      'rules',
      'source',
    );
    const request = fetchMock.mock.calls[0][1];
    expect(requestBody().format).toBeUndefined();
    expect((request.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key',
    );
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('reports missing configuration without making a request', async () => {
    await expect(
      service({}).generateJsonResponse('rules', 'source'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    new Response('private bank data', { status: 500 }),
    new Response(JSON.stringify({ message: { content: 'invalid json' } })),
    new Response(
      JSON.stringify({
        message: { content: '{"rows":[]}' },
        done_reason: 'length',
      }),
    ),
  ])(
    'rejects errors and truncation without exposing provider content (%#)',
    async (response) => {
      fetchMock.mockResolvedValue(response);
      await expect(
        service({ OLLAMA_API_KEY: 'test-key' }).generateJsonResponse(
          'rules',
          'source',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    },
  );
});
