import env from '../../config/env.js';
import { AI_DEFAULT_GEMINI_MODEL, AI_DEFAULT_IMAGE_MODEL } from './ai.constants.js';

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
