import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiContentPolicyError, AiOutputError, AiProviderError } from '../../../src/modules/ai/ai.errors.js';
import { cloudflareImageClient, geminiClient } from '../../../src/modules/ai/ai.providers.js';

// Key giả để test không phụ thuộc .env của máy chạy (CI không có key thật).
vi.mock('../../../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config/env.js')>();
  const env = {
    ...actual.default,
    GEMINI_API_KEY: 'test-gemini-key',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    CLOUDFLARE_API_TOKEN: 'test-token',
  };
  return { ...actual, env, default: env };
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Gemini client', () => {
  it('gửi structured output request và trả JSON đã parse', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ title: 'Tiêu đề', blocks: [] }) }],
            },
            finishReason: 'STOP',
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await geminiClient.generateJson({
      model: 'gemini-3.8-flash',
      systemInstruction: 'system',
      userPrompt: 'user',
      responseSchema: { type: 'object' },
    });

    expect(result).toEqual({ title: 'Tiêu đề', blocks: [] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-3.8-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBeTruthy();
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toEqual({ type: 'object' });
    expect(body.systemInstruction.parts[0].text).toBe('system');
  });

  it('ném AiContentPolicyError khi bị chặn chính sách', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }))
    );

    await expect(
      geminiClient.generateJson({
        model: 'gemini-3.8-flash',
        systemInstruction: 'system',
        userPrompt: 'user',
        responseSchema: { type: 'object' },
      })
    ).rejects.toBeInstanceOf(AiContentPolicyError);
  });

  it('ném AiOutputError khi model trả JSON không hợp lệ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'không phải json' }] }, finishReason: 'STOP' }],
        })
      )
    );

    await expect(
      geminiClient.generateJson({
        model: 'gemini-3.8-flash',
        systemInstruction: 'system',
        userPrompt: 'user',
        responseSchema: { type: 'object' },
      })
    ).rejects.toBeInstanceOf(AiOutputError);
  });

  it('ném AiProviderError khi HTTP lỗi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 500)));

    await expect(
      geminiClient.generateJson({
        model: 'gemini-3.8-flash',
        systemInstruction: 'system',
        userPrompt: 'user',
        responseSchema: { type: 'object' },
      })
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});

describe('Cloudflare image client', () => {
  it('decode base64 trong result.image thành Buffer JPEG', async () => {
    const bytes = Buffer.from('fake-jpeg');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, result: { image: bytes.toString('base64') } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await cloudflareImageClient.generateImage({
      model: '@cf/black-forest-labs/flux-1-schnell',
      prompt: 'một chiếc áo',
    });

    expect(result.equals(bytes)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/ai/run/@cf/black-forest-labs/flux-1-schnell');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ prompt: 'một chiếc áo', steps: 4 });
  });

  it('ném AiProviderError khi Cloudflare trả success=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: false, errors: ['boom'] }))
    );

    await expect(
      cloudflareImageClient.generateImage({
        model: '@cf/black-forest-labs/flux-1-schnell',
        prompt: 'một chiếc áo',
      })
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});
