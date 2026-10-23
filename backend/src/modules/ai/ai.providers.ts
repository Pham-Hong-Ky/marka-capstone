import env from '../../config/env.js';
import { AI_FETCH_TIMEOUT_MS, AI_TEXT_MAX_OUTPUT_TOKENS } from './ai.constants.js';
import {
  AiContentPolicyError,
  AiOutputError,
  AiProviderConfigError,
  AiProviderError,
} from './ai.errors.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const CLOUDFLARE_BASE_URL = 'https://api.cloudflare.com/client/v4';

const POLICY_FINISH_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
]);

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

interface CloudflareResponse {
  success?: boolean;
  result?: { image?: string };
  errors?: unknown[];
}

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const geminiClient = {
  async generateJson({
    model,
    systemInstruction,
    userPrompt,
    responseSchema,
  }: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    responseSchema: unknown;
  }): Promise<unknown> {
    if (!env.GEMINI_API_KEY) {
      throw new AiProviderConfigError('Chưa cấu hình GEMINI_API_KEY');
    }

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: AI_TEXT_MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
        signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
      }
    );

    const data = (await readJson(response)) as GeminiResponse | null;

    if (!response.ok) {
      throw new AiProviderError(
        `Gemini trả lỗi HTTP ${response.status}`,
        isRetryableStatus(response.status)
      );
    }

    if (data?.promptFeedback?.blockReason) {
      throw new AiContentPolicyError(
        `Gemini chặn nội dung: ${data.promptFeedback.blockReason}`
      );
    }

    const candidate = data?.candidates?.[0];
    if (!candidate) {
      throw new AiProviderError('Gemini không trả về nội dung');
    }

    if (candidate.finishReason && POLICY_FINISH_REASONS.has(candidate.finishReason)) {
      throw new AiContentPolicyError(`Gemini chặn nội dung: ${candidate.finishReason}`);
    }

    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new AiOutputError(`Gemini dừng với lý do ${candidate.finishReason}`);
    }

    const text = (candidate.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new AiOutputError('Gemini trả về nội dung rỗng');
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AiOutputError('Gemini trả về JSON không hợp lệ');
    }
  },
};

export const cloudflareImageClient = {
  async generateImage({ model, prompt }: { model: string; prompt: string }): Promise<Buffer> {
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
      throw new AiProviderConfigError('Chưa cấu hình Cloudflare Workers AI');
    }

    const response = await fetch(
      `${CLOUDFLARE_BASE_URL}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, steps: 4 }),
        signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
      }
    );

    const data = (await readJson(response)) as CloudflareResponse | null;

    if (!response.ok || !data?.success) {
      const details = data?.errors ? JSON.stringify(data.errors) : `HTTP ${response.status}`;
      throw new AiProviderError(
        `Cloudflare Workers AI lỗi: ${details}`,
        isRetryableStatus(response.status)
      );
    }

    const base64 = data.result?.image;
    if (typeof base64 !== 'string' || base64.trim() === '') {
      throw new AiOutputError('Cloudflare không trả về dữ liệu ảnh');
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) {
      throw new AiOutputError('Ảnh Cloudflare trả về rỗng');
    }

    return buffer;
  },
};

export default {
  geminiClient,
  cloudflareImageClient,
};
