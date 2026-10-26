import env from '../../config/env.js';

export const AI_TEXT_COST = 10;
export const AI_IMAGE_COST = 20;

export const AI_TEXT_PROVIDER = 'gemini';
export const AI_IMAGE_PROVIDER = 'cloudflare';

export const AI_DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';
export const AI_DEFAULT_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export const AI_FETCH_TIMEOUT_MS = 60_000;
export const AI_IMAGE_MAX_PROMPT_LENGTH = 2048;
export const AI_IMAGE_ART_PROMPT_MAX_LENGTH = 600;
export const AI_IMAGE_CONTENT_LIMIT = 800;
export const AI_IMAGE_STEPS = 8;

export const AI_TEXT_MAX_OUTPUT_TOKENS = 4096;
export const AI_TEXT_TEMPERATURE = 0.7;

export const AI_BRAND_VOICE_EXAMPLE_LIMIT = 2;
export const AI_BRAND_VOICE_EXAMPLE_MAX_LENGTH = 800;

export const isTextAiConfigured = (): boolean => Boolean(env.GEMINI_API_KEY);

export const isImageAiConfigured = (): boolean =>
  Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);

export const getGeminiModel = (): string => env.GEMINI_MODEL || AI_DEFAULT_GEMINI_MODEL;

export const getImageModel = (): string => env.CLOUDFLARE_IMAGE_MODEL || AI_DEFAULT_IMAGE_MODEL;

export default {
  isTextAiConfigured,
  isImageAiConfigured,
  getGeminiModel,
  getImageModel,
};
