import { z } from 'zod';
import {
  AI_IMAGE_CONTENT_LIMIT,
  AI_IMAGE_MAX_PROMPT_LENGTH,
} from './ai.constants.js';
import { AiOutputError } from './ai.errors.js';

export interface BrandVoice {
  industry?: string;
  targetAudience?: string;
  writingStyle?: string;
  keywordsShouldUse?: string[];
  keywordsAvoid?: string[];
  fewShotExamples?: Array<{ title?: string; content: string }>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

export const aiTextBlockSchema = z.object({
  type: z.enum(['paragraph', 'heading', 'bulletList']),
  text: z.string().trim().max(5000).optional(),
  items: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
});

export const aiTextOutputSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
  blocks: z.array(aiTextBlockSchema).min(1).max(30),
});

export type AiTextOutput = z.infer<typeof aiTextOutputSchema>;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim());
  return items.length > 0 ? items : undefined;
};

export const normalizeBrandVoice = (value: unknown): BrandVoice => {
  if (!value || typeof value !== 'object') return {};

  const raw = value as Record<string, unknown>;
  const examples = Array.isArray(raw.fewShotExamples)
    ? raw.fewShotExamples
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({ title: asString(item.title), content: asString(item.content) ?? '' }))
        .filter((item) => item.content !== '')
    : undefined;

  return {
    industry: asString(raw.industry),
    targetAudience: asString(raw.targetAudience),
    writingStyle: asString(raw.writingStyle),
    keywordsShouldUse: asStringArray(raw.keywordsShouldUse),
    keywordsAvoid: asStringArray(raw.keywordsAvoid),
    ...(examples && examples.length > 0 ? { fewShotExamples: examples } : {}),
  };
};

export const aiTextResponseSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Tiêu đề bài viết, tối đa 120 ký tự',
    },
    blocks: {
      type: 'array',
      description: 'Các khối nội dung theo thứ tự',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['paragraph', 'heading', 'bulletList'],
          },
          text: {
            type: 'string',
            description: 'Nội dung cho paragraph hoặc heading',
          },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Các gạch đầu dòng cho bulletList',
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['title', 'blocks'],
} as const;

export const buildTextPrompt = ({
  topic,
  instructions,
  brandVoice,
}: {
  topic: string;
  instructions?: string;
  brandVoice?: unknown;
}) => {
  const voice = normalizeBrandVoice(brandVoice);

  const systemInstruction = [
    'Bạn là chuyên gia sáng tạo nội dung mạng xã hội cho marketer Việt Nam.',
    'Viết bằng tiếng Việt tự nhiên, rõ ràng, tránh sáo rỗng và không bịa số liệu hoặc thông tin sản phẩm.',
    'Bài viết cần có tiêu đề hấp dẫn (tối đa 120 ký tự), mở bài, thân bài và kết bài có CTA.',
    'Dùng heading hoặc bulletList khi giúp bài dễ đọc hơn.',
    'Tuân thủ Brand Voice sau:',
    JSON.stringify(voice, null, 2),
    'Chỉ trả về JSON đúng schema, không thêm markdown hay giải thích.',
  ].join('\n');

  const userPrompt = [
    `Chủ đề: ${topic}`,
    instructions ? `Yêu cầu thêm: ${instructions}` : 'Yêu cầu thêm: không có',
    'Hãy tạo một bài viết mạng xã hội hoàn chỉnh.',
  ].join('\n');

  return { systemInstruction, userPrompt, responseSchema: aiTextResponseSchema };
};

export const parseTextOutput = (value: unknown): AiTextOutput => {
  const parsed = aiTextOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new AiOutputError('AI trả về JSON không đúng cấu trúc bài viết');
  }
  return parsed.data;
};

const textNode = (text: string): TiptapNode => ({ type: 'text', text });

export const toTiptapDoc = (output: AiTextOutput): TiptapNode => {
  const content: TiptapNode[] = [];

  for (const block of output.blocks) {
    if (block.type === 'heading' && block.text?.trim()) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [textNode(block.text.trim())],
      });
      continue;
    }

    if (block.type === 'paragraph' && block.text?.trim()) {
      content.push({
        type: 'paragraph',
        content: [textNode(block.text.trim())],
      });
      continue;
    }

    if (block.type === 'bulletList') {
      const items = (block.items ?? []).map((item) => item.trim()).filter(Boolean);
      if (items.length > 0) {
        content.push({
          type: 'bulletList',
          content: items.map((item) => ({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [textNode(item)],
              },
            ],
          })),
        });
      }
    }
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
};

export const contentToPlainText = (content: unknown): string => {
  const collect = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';

    const record = node as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof record.text === 'string') return record.text;
    if (!Array.isArray(record.content)) return '';

    const separator =
      record.type === 'doc' || record.type === 'bulletList' || record.type === 'orderedList'
        ? '\n'
        : '';

    return record.content.map(collect).join(separator);
  };

  return collect(content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

export const buildImagePrompt = ({
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
  const parts = [
    'Tạo một ảnh minh hoạ chất lượng cao cho bài viết mạng xã hội.',
    title ? `Tiêu đề: ${title}` : '',
    contentText ? `Nội dung: ${contentText.slice(0, AI_IMAGE_CONTENT_LIMIT)}` : '',
    voice.industry ? `Ngành hàng: ${voice.industry}` : '',
    voice.targetAudience ? `Khách hàng mục tiêu: ${voice.targetAudience}` : '',
    voice.writingStyle ? `Phong cách: ${voice.writingStyle}` : '',
    instructions ? `Yêu cầu thêm: ${instructions}` : '',
    'Ảnh vuông, bố cục rõ ràng, ánh sáng tự nhiên, không chèn chữ, logo hay watermark.',
  ].filter(Boolean);

  return parts.join('\n').slice(0, AI_IMAGE_MAX_PROMPT_LENGTH);
};

export default {
  buildTextPrompt,
  buildImagePrompt,
  parseTextOutput,
  toTiptapDoc,
  contentToPlainText,
  normalizeBrandVoice,
  aiTextOutputSchema,
};
