import env from '../../config/env.js';
import {
  AI_FETCH_TIMEOUT_MS,
  AI_IMAGE_STEPS,
  AI_TEXT_MAX_OUTPUT_TOKENS,
  AI_TEXT_TEMPERATURE,
} from './ai.config.js';
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

const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

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

const isSuccessStatus = (status: number) => status >= 200 && status < 300;

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getGeminiApiKey = (): string => {
  if (!env.GEMINI_API_KEY) {
    throw new AiProviderConfigError('Chưa cấu hình GEMINI_API_KEY');
  }
  return env.GEMINI_API_KEY;
};

const buildGeminiBody = ({
  systemInstruction,
  userPrompt,
  responseSchema,
}: {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: unknown;
}) => ({
  systemInstruction: { parts: [{ text: systemInstruction }] },
  contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  safetySettings: SAFETY_SETTINGS,
  generationConfig: {
    temperature: AI_TEXT_TEMPERATURE,
    maxOutputTokens: AI_TEXT_MAX_OUTPUT_TOKENS,
    responseMimeType: 'application/json',
    responseSchema,
  },
});

const extractGeminiText = (data: GeminiResponse): string => {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new AiProviderError('Gemini không trả về nội dung');
  }

  if (candidate.finishReason && POLICY_FINISH_REASONS.has(candidate.finishReason)) {
    throw new AiContentPolicyError(`Gemini chặn nội dung: ${candidate.finishReason}`);
  }

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new AiOutputError(`Gemini dừng với lý do ${candidate.finishReason}`);
  }

  return (candidate.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim();
};

const parseGeminiResponse = (status: number, data: GeminiResponse | null): unknown => {
  if (!isSuccessStatus(status)) {
    throw new AiProviderError(`Gemini trả lỗi HTTP ${status}`, isRetryableStatus(status));
  }

  if (data?.promptFeedback?.blockReason) {
    throw new AiContentPolicyError(`Gemini chặn nội dung: ${data.promptFeedback.blockReason}`);
  }

  const text = extractGeminiText(data ?? {});
  if (!text) {
    throw new AiOutputError('Gemini trả về nội dung rỗng');
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiOutputError('Gemini trả về JSON không hợp lệ');
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
    const apiKey = getGeminiApiKey();

    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(buildGeminiBody({ systemInstruction, userPrompt, responseSchema })),
        signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
      }
    );

    const data = (await readJson(response)) as GeminiResponse | null;
    return parseGeminiResponse(response.status, data);
  },
};

const getCloudflareCredentials = (): { accountId: string; apiToken: string } => {
  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = env;

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    throw new AiProviderConfigError('Chưa cấu hình Cloudflare Workers AI');
  }

  return { accountId: CLOUDFLARE_ACCOUNT_ID, apiToken: CLOUDFLARE_API_TOKEN };
};

const parseCloudflareImage = (status: number, data: CloudflareResponse | null): Buffer => {
  if (!isSuccessStatus(status) || !data?.success) {
    const details = data?.errors ? JSON.stringify(data.errors) : `HTTP ${status}`;
    throw new AiProviderError(
      `Cloudflare Workers AI lỗi: ${details}`,
      isRetryableStatus(status)
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
};

export const cloudflareImageClient = {
  async generateImage({ model, prompt }: { model: string; prompt: string }): Promise<Buffer> {
    const { accountId, apiToken } = getCloudflareCredentials();

    const response = await fetch(
      `${CLOUDFLARE_BASE_URL}/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, steps: AI_IMAGE_STEPS }),
        signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS),
      }
    );

    const data = (await readJson(response)) as CloudflareResponse | null;
    return parseCloudflareImage(response.status, data);
  },
};

export default {
  geminiClient,
  cloudflareImageClient,
};
