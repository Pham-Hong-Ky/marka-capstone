import { z } from 'zod';
import type { SocialPlatform } from '@prisma/client';
import {
  AI_BRAND_VOICE_EXAMPLE_LIMIT,
  AI_BRAND_VOICE_EXAMPLE_MAX_LENGTH,
} from './ai.config.js';
import { AiOutputError } from './ai.errors.js';
import { parseStoredPayload } from './ai.payload.js';

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

export interface TextPromptPayload {
  systemInstruction: string;
  userPrompt: string;
}

export const aiTextBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('paragraph'),
    text: z.string().trim().min(1).max(5000),
  }),
  z.object({
    type: z.literal('heading'),
    text: z.string().trim().min(1).max(5000),
  }),
  z.object({
    type: z.literal('bulletList'),
    items: z.array(z.string().trim().min(1).max(1000)).min(1).max(20),
  }),
]);

export type AiTextBlock = z.infer<typeof aiTextBlockSchema>;

export const aiTextOutputSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255),
  blocks: z.array(aiTextBlockSchema).min(1).max(30),
});

export type AiTextOutput = z.infer<typeof aiTextOutputSchema>;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim());
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
            description: 'Loại khối nội dung',
          },
          text: {
            type: 'string',
            description: 'Bắt buộc khi type là paragraph hoặc heading',
          },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Bắt buộc khi type là bulletList, mỗi phần tử là một gạch đầu dòng',
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['title', 'blocks'],
} as const;

const renderBrandVoiceExamples = (
  examples?: BrandVoice['fewShotExamples']
): string | undefined => {
  const picked = examples?.slice(0, AI_BRAND_VOICE_EXAMPLE_LIMIT);
  if (!picked?.length) return undefined;

  const rendered = picked
    .map((example) => {
      const content = example.content.slice(0, AI_BRAND_VOICE_EXAMPLE_MAX_LENGTH);
      return `${example.title ? `${example.title}: ` : ''}${content}`;
    })
    .map((text, index) => `Ví dụ ${index + 1}: ${text}`)
    .join('\n');

  return [
    '- Học phong cách từ các bài mẫu dưới đây: cách mở bài, nhịp câu, xưng hô, CTA, cách dùng emoji và hashtag, không sao chép nguyên văn.',
    rendered,
  ].join('\n');
};

const buildBrandVoiceRules = (voice: BrandVoice): string[] => {
  const rules = [
    voice.industry ? `- Ngành hàng: ${voice.industry}` : undefined,
    voice.targetAudience ? `- Khách hàng mục tiêu: ${voice.targetAudience}` : undefined,
    voice.writingStyle ? `- Giọng điệu: ${voice.writingStyle}` : undefined,
    voice.keywordsShouldUse?.length
      ? `- Từ khoá nên dùng tự nhiên, không nhồi nhét: ${voice.keywordsShouldUse.join(', ')}`
      : undefined,
    voice.keywordsAvoid?.length
      ? `- Tuyệt đối không dùng: ${voice.keywordsAvoid.join(', ')}`
      : undefined,
    voice.keywordsAvoid?.length
      ? '- Nếu bài mẫu hoặc yêu cầu mâu thuẫn với từ khoá cấm, ưu tiên từ khoá cấm.'
      : undefined,
    renderBrandVoiceExamples(voice.fewShotExamples),
  ];

  return rules.filter((rule): rule is string => Boolean(rule));
};

const TEXT_BASE_RULES = [
  'Bạn là chuyên gia sáng tạo nội dung mạng xã hội cho marketer Việt Nam.',
  'Viết bài đăng mạng xã hội bằng tiếng Việt tự nhiên, giàu cảm xúc, phù hợp người đọc phổ thông.',
  'Quy tắc ngôn ngữ:',
  '- Luôn viết tiếng Việt có dấu đầy đủ và đúng chính tả, kể cả khi chủ đề hoặc yêu cầu của người dùng được gõ không dấu. Hiểu nghĩa rồi viết lại cho chuẩn.',
  '- Không dùng cú pháp markdown (**đậm**, # tiêu đề); emoji và hashtag vẫn được phép.',
  'Cấu trúc bắt buộc:',
  '- Tiêu đề tối đa 120 ký tự, hấp dẫn, có thể kèm 1 emoji.',
];

const TEXT_DEFAULT_CONTENT_RULES = [
  '- Mở bài là hook 1-2 câu gợi cảm xúc hoặc nêu lợi ích, không mở bằng định nghĩa chung chung.',
  '- Thân bài có ít nhất 2 đoạn văn liền mạch, mỗi đoạn 3-5 câu với chi tiết cụ thể.',
  '- Chỉ dùng 1 bulletList 3-5 ý ngắn khi thật sự giúp dễ đọc; không được biến cả bài thành danh sách.',
  '- Kết bài có CTA cụ thể (bình luận, lưu bài, chia sẻ hoặc đặt lịch).',
  '- Block cuối là một paragraph chứa 3-5 hashtag liên quan trực tiếp, viết liền không dấu (ví dụ #HaNoi #DuLich).',
  '- Dùng 2-5 emoji phù hợp ngữ cảnh, đặt ở đầu đoạn hoặc đầu dòng; không lạm dụng.',
  'Độ dài 250-400 từ (không tính hashtag), tối đa 3 heading.',
];

interface ChannelContentProfile {
  label: string;
  maxChars: number;
  minHashtags: number;
  maxHashtags: number;
  minEmoji: number;
  maxEmoji: number;
  allowHeadings: boolean;
  allowBulletList: boolean;
  styleHint: string;
}

const CHANNEL_CONTENT_PROFILES: Partial<Record<SocialPlatform, ChannelContentProfile>> = {
  FACEBOOK: {
    label: 'Facebook',
    maxChars: 2200,
    minHashtags: 3,
    maxHashtags: 5,
    minEmoji: 2,
    maxEmoji: 5,
    allowHeadings: true,
    allowBulletList: true,
    styleHint: 'Giọng gần gũi, kể chuyện, có thể viết dài; CTA rõ ràng.',
  },
  THREADS: {
    label: 'Threads',
    maxChars: 480,
    minHashtags: 1,
    maxHashtags: 3,
    minEmoji: 0,
    maxEmoji: 2,
    allowHeadings: false,
    allowBulletList: false,
    styleHint: 'Giọng hội thoại, ngắn gọn như đang trò chuyện; kết bằng câu hỏi mời thảo luận.',
  },
};

const DEFAULT_CHANNEL_PROFILE: ChannelContentProfile = {
  label: 'Mạng xã hội',
  maxChars: 2200,
  minHashtags: 3,
  maxHashtags: 5,
  minEmoji: 2,
  maxEmoji: 5,
  allowHeadings: true,
  allowBulletList: true,
  styleHint: 'Giọng tự nhiên, dễ đọc trên điện thoại.',
};

const getChannelProfiles = (platforms: SocialPlatform[]): ChannelContentProfile[] =>
  platforms.map((platform) => CHANNEL_CONTENT_PROFILES[platform] ?? DEFAULT_CHANNEL_PROFILE);

const mergeChannelProfiles = (profiles: ChannelContentProfile[]) => {
  const maxHashtags = Math.min(...profiles.map((profile) => profile.maxHashtags));
  const maxEmoji = Math.min(...profiles.map((profile) => profile.maxEmoji));

  return {
    maxChars: Math.min(...profiles.map((profile) => profile.maxChars)),
    minHashtags: Math.min(Math.max(...profiles.map((profile) => profile.minHashtags)), maxHashtags),
    maxHashtags,
    minEmoji: Math.min(Math.max(...profiles.map((profile) => profile.minEmoji)), maxEmoji),
    maxEmoji,
    allowHeadings: profiles.every((profile) => profile.allowHeadings),
    allowBulletList: profiles.every((profile) => profile.allowBulletList),
  };
};

const buildChannelStructureRule = (allowHeadings: boolean, allowBulletList: boolean): string => {
  if (!allowHeadings) {
    return '- Không dùng heading, không dùng bulletList; chia thành 2-3 đoạn ngắn, câu ngắn dễ đọc trên điện thoại.';
  }

  if (!allowBulletList) {
    return '- Có 2-4 đoạn văn liền mạch, không dùng bulletList; không biến cả bài thành danh sách.';
  }

  return '- Có 2-4 đoạn văn liền mạch; chỉ dùng 1 bulletList 3-5 ý khi thật sự giúp dễ đọc, không biến cả bài thành danh sách.';
};

const formatCountRule = (min: number, max: number, unit: string): string =>
  min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;

const buildChannelRules = (platforms: SocialPlatform[]): string[] => {
  const profiles = getChannelProfiles(platforms);
  const merged = mergeChannelProfiles(profiles);
  const labels = profiles.map((profile) => profile.label).join(', ');
  const emojiRule =
    merged.minEmoji === 0
      ? `- Dùng tối đa ${merged.maxEmoji} emoji phù hợp ngữ cảnh; có thể không dùng emoji.`
      : `- Dùng ${formatCountRule(merged.minEmoji, merged.maxEmoji, 'emoji')} phù hợp ngữ cảnh, đặt ở đầu đoạn hoặc đầu dòng; không lạm dụng.`;

  return [
    `Kênh đăng bài: ${labels}.`,
    'Viết một bài duy nhất để đăng được trên tất cả kênh đã chọn.',
    'Đặc thù từng kênh:',
    ...profiles.map((profile) => `- ${profile.label}: ${profile.styleHint}`),
    'Ràng buộc chung:',
    `- Toàn bộ nội dung (không tính tiêu đề) tối đa ${merged.maxChars} ký tự.`,
    '- Mở bài là hook 1-2 câu gợi cảm xúc hoặc nêu lợi ích, không mở bằng định nghĩa chung chung.',
    buildChannelStructureRule(merged.allowHeadings, merged.allowBulletList),
    '- Kết bài có CTA cụ thể (bình luận, lưu bài, chia sẻ hoặc đặt lịch).',
    `- Block cuối là một paragraph chứa ${formatCountRule(merged.minHashtags, merged.maxHashtags, 'hashtag')} liên quan trực tiếp, viết liền không dấu (ví dụ #HaNoi #DuLich).`,
    emojiRule,
  ];
};

const TEXT_SAFETY_RULES = [
  'Không bịa số liệu, giá, khuyến mãi, chứng nhận hay thông tin sản phẩm không có trong chủ đề và yêu cầu.',
  'Trả về JSON đúng schema: block paragraph/heading phải có "text", block bulletList phải có "items".',
];

const TEXT_DEFAULT_BRAND_VOICE_RULE =
  '- Chưa cấu hình, dùng giọng trung tính, chuyên nghiệp.';

const TEXT_CLOSING_RULES = [
  'Nếu yêu cầu thêm của người dùng xung đột với hướng dẫn chung, ưu tiên yêu cầu thêm.',
  'Chỉ trả về JSON đúng schema, không thêm markdown hay giải thích.',
];

const buildTextSystemInstruction = (
  voice: BrandVoice,
  platforms: SocialPlatform[] = []
): string => {
  const voiceRules = buildBrandVoiceRules(voice);
  const contentRules =
    platforms.length > 0 ? buildChannelRules(platforms) : TEXT_DEFAULT_CONTENT_RULES;

  return [
    ...TEXT_BASE_RULES,
    ...contentRules,
    ...TEXT_SAFETY_RULES,
    'Brand Voice:',
    ...(voiceRules.length > 0 ? voiceRules : [TEXT_DEFAULT_BRAND_VOICE_RULE]),
    ...TEXT_CLOSING_RULES,
  ].join('\n');
};

const buildTextUserPrompt = (
  topic: string,
  instructions?: string,
  platforms: SocialPlatform[] = []
): string =>
  [
    `Chủ đề: ${topic}`,
    instructions ? `Yêu cầu thêm: ${instructions}` : 'Yêu cầu thêm: không có',
    platforms.length > 0
      ? `Kênh đăng bài: ${getChannelProfiles(platforms)
          .map((profile) => profile.label)
          .join(', ')}. Bám đúng giới hạn của các kênh này.`
      : null,
    'Viết bài hoàn chỉnh theo đúng cấu trúc trên. Nhắc lại: tiếng Việt có dấu đầy đủ, có emoji và hashtag ở cuối bài.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

export const buildTextPrompt = ({
  topic,
  instructions,
  brandVoice,
  platforms = [],
}: {
  topic: string;
  instructions?: string;
  brandVoice?: unknown;
  platforms?: SocialPlatform[];
}) => {
  const voice = normalizeBrandVoice(brandVoice);

  return {
    systemInstruction: buildTextSystemInstruction(voice, platforms),
    userPrompt: buildTextUserPrompt(topic, instructions, platforms),
    responseSchema: aiTextResponseSchema,
  };
};

export const parseTextOutput = (value: unknown): AiTextOutput => {
  const parsed = aiTextOutputSchema.safeParse(value);
  if (!parsed.success) {
    throw new AiOutputError('AI trả về JSON không đúng cấu trúc bài viết');
  }
  return parsed.data;
};

export const serializeTextPrompt = (payload: TextPromptPayload): string =>
  JSON.stringify(payload);

const textPromptPayloadSchema = z.object({
  systemInstruction: z.string().min(1),
  userPrompt: z.string().min(1),
});

export const parseTextPromptPayload = (prompt: string): TextPromptPayload =>
  parseStoredPayload(prompt, textPromptPayloadSchema);

const textNode = (text: string): TiptapNode => ({ type: 'text', text });

const toHeadingNode = (text: string): TiptapNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [textNode(text.trim())],
});

const toParagraphNode = (text: string): TiptapNode => ({
  type: 'paragraph',
  content: [textNode(text.trim())],
});

const toListItemNode = (text: string): TiptapNode => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content: [textNode(text)] }],
});

const toBulletListNode = (items: string[]): TiptapNode | null => {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) return null;

  return {
    type: 'bulletList',
    content: normalized.map(toListItemNode),
  };
};

const toBlockNode = (block: AiTextBlock): TiptapNode | null => {
  switch (block.type) {
    case 'heading': {
      const text = block.text.trim();
      return text ? toHeadingNode(text) : null;
    }
    case 'paragraph': {
      const text = block.text.trim();
      return text ? toParagraphNode(text) : null;
    }
    case 'bulletList':
      return toBulletListNode(block.items);
  }
};

export const toTiptapDoc = (output: AiTextOutput): TiptapNode => {
  const content = output.blocks
    .map(toBlockNode)
    .filter((node): node is TiptapNode => node !== null);

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
};

const collectText = (node: unknown): string => {
  if (!node || typeof node !== 'object') return '';

  const record = node as { type?: unknown; text?: unknown; content?: unknown };
  if (typeof record.text === 'string') return record.text;
  if (!Array.isArray(record.content)) return '';

  const separator =
    record.type === 'doc' || record.type === 'bulletList' || record.type === 'orderedList'
      ? '\n'
      : '';

  return record.content.map(collectText).join(separator);
};

export const contentToPlainText = (content: unknown): string =>
  collectText(content)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

export default {
  buildTextPrompt,
  parseTextOutput,
  parseTextPromptPayload,
  serializeTextPrompt,
  toTiptapDoc,
  contentToPlainText,
  normalizeBrandVoice,
  aiTextOutputSchema,
};
