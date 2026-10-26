import { z } from 'zod';
import {
  AI_IMAGE_ART_PROMPT_MAX_LENGTH,
  AI_IMAGE_CONTENT_LIMIT,
  AI_IMAGE_MAX_PROMPT_LENGTH,
} from './ai.config.js';
import { AiOutputError, AiProviderConfigError } from './ai.errors.js';
import { normalizeBrandVoice } from './ai.prompt.js';

export interface ImageSourcePayload {
  title?: string | null;
  contentText?: string;
  instructions?: string | null;
  brandVoice?: unknown;
  imagePrompt?: string;
}

export const aiImageArtResponseSchema = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description: 'English text-to-image prompt for FLUX.1, 1-3 sentences',
    },
  },
  required: ['prompt'],
} as const;

export const aiImageArtOutputSchema = z.object({
  prompt: z.string().trim().min(10).max(AI_IMAGE_MAX_PROMPT_LENGTH),
});

const IMAGE_ART_SYSTEM_INSTRUCTION = [
  'You are an art director writing text-to-image prompts for FLUX.1.',
  'Convert the Vietnamese marketing post below into ONE English image prompt.',
  'Describe the main subject, setting, composition, camera angle, lighting, color palette and mood.',
  'Use concrete visual details and avoid abstract marketing words.',
  `Keep the prompt under ${AI_IMAGE_ART_PROMPT_MAX_LENGTH} characters.`,
  'Set the scene in contemporary Vietnam. If people appear, describe them as Vietnamese with Southeast Asian features and modern Vietnamese clothing.',
  'For product posts (clothing, accessories, food, cosmetics), prefer a product-focused composition (studio, flat lay or mannequin) and include a person only when the post is about lifestyle or the user asks for one.',
  'Never use Chinese, Japanese or Korean cultural elements: hanfu, qipao or cheongsam, pagoda-style roofs, paper lanterns, calligraphy, palace gates.',
  'When the post mentions a specific Vietnamese landmark, describe that landmark accurately instead of a generic Asian scene.',
  'The image must contain no text, no letters, no logos, no watermarks, no UI elements or brand marks.',
  'Do not invent product details that are not present in the post.',
  'Return only JSON: { "prompt": "..." }.',
].join('\n');

const buildImageArtUserPrompt = ({
  title,
  contentText,
  instructions,
  industry,
  targetAudience,
  writingStyle,
}: {
  title?: string;
  contentText?: string;
  instructions?: string;
  industry?: string;
  targetAudience?: string;
  writingStyle?: string;
}): string =>
  [
    title ? `Post title: ${title}` : '',
    contentText ? `Post content: ${contentText.slice(0, AI_IMAGE_CONTENT_LIMIT)}` : '',
    industry ? `Industry: ${industry}` : '',
    targetAudience ? `Target audience: ${targetAudience}` : '',
    writingStyle ? `Brand style: ${writingStyle}` : '',
    'Market: Vietnam',
    instructions ? `Extra direction from user: ${instructions}` : '',
    'Write the image prompt now.',
  ]
    .filter(Boolean)
    .join('\n');

export const buildImageArtPrompt = ({
  title,
  contentText,
  instructions,
  brandVoice,
}: {
  title?: string;
  contentText?: string;
  instructions?: string;
  brandVoice?: unknown;
}) => {
  const voice = normalizeBrandVoice(brandVoice);

  return {
    systemInstruction: IMAGE_ART_SYSTEM_INSTRUCTION,
    userPrompt: buildImageArtUserPrompt({
      title,
      contentText,
      instructions,
      industry: voice.industry,
      targetAudience: voice.targetAudience,
      writingStyle: voice.writingStyle,
    }),
    responseSchema: aiImageArtResponseSchema,
  };
};

export const parseImageArtOutput = (value: unknown): string => {
  const parsed = aiImageArtOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new AiOutputError('AI trả về prompt ảnh không đúng cấu trúc');
  }
  return parsed.data.prompt;
};

const AI_IMAGE_FINAL_CONSTRAINTS =
  'Square 1:1 composition, high quality, professional social media photography. Contemporary Vietnamese setting. If people appear, they are Vietnamese with Southeast Asian features and modern clothing. Avoid Chinese, Japanese and Korean traditional clothing, architecture, lanterns and calligraphy. No text, no letters, no logo, no watermark, no UI elements.';

export const buildImagePrompt = (artPrompt: string): string => {
  const headroom = AI_IMAGE_MAX_PROMPT_LENGTH - AI_IMAGE_FINAL_CONSTRAINTS.length - 1;
  const base = artPrompt.trim().slice(0, Math.max(0, headroom));
  return `${base} ${AI_IMAGE_FINAL_CONSTRAINTS}`.trim();
};

export const serializeImageSource = (source: ImageSourcePayload): string =>
  JSON.stringify(source);

const imageSourceSchema = z
  .object({
    imagePrompt: z.string().optional(),
    title: z.string().nullish(),
    contentText: z.string().optional(),
    instructions: z.string().nullish(),
    brandVoice: z.unknown().optional(),
  })
  .passthrough();

export const parseImageSourcePayload = (prompt: string): ImageSourcePayload => {
  try {
    return imageSourceSchema.parse(JSON.parse(prompt) as unknown);
  } catch {
    throw new AiProviderConfigError('Dữ liệu prompt của generation không hợp lệ');
  }
};

export default {
  buildImageArtPrompt,
  buildImagePrompt,
  parseImageArtOutput,
  parseImageSourcePayload,
  serializeImageSource,
};
