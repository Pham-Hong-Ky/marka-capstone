import { z } from 'zod';

const MAX_KEYWORDS = 30;
const MAX_KEYWORD_LENGTH = 50;
export const MAX_FEW_SHOT_EXAMPLES = 3;

export const parseKeywords = (value: string): string[] => [
  ...new Set(
    value
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean)
  ),
];

export const formatKeywords = (keywords: string[]): string => keywords.join(', ');

const keywordListField = (label: string) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const keywords = parseKeywords(value);

      if (keywords.length > MAX_KEYWORDS) {
        ctx.addIssue({ code: 'custom', message: `${label} tối đa ${MAX_KEYWORDS} từ khoá` });
      }

      const tooLong = keywords.find((keyword) => keyword.length > MAX_KEYWORD_LENGTH);
      if (tooLong) {
        ctx.addIssue({
          code: 'custom',
          message: `Từ khoá "${tooLong}" tối đa ${MAX_KEYWORD_LENGTH} ký tự`,
        });
      }
    });

export const fewShotExampleSchema = z.object({
  title: z.string().trim().max(100, 'Tiêu đề bài mẫu tối đa 100 ký tự'),
  content: z
    .string()
    .trim()
    .min(10, 'Nội dung bài mẫu tối thiểu 10 ký tự')
    .max(5000, 'Nội dung bài mẫu tối đa 5000 ký tự'),
});

export const brandVoiceFormSchema = z.object({
  industry: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập ngành hàng')
    .max(100, 'Ngành hàng tối đa 100 ký tự'),
  targetAudience: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập đối tượng mục tiêu')
    .max(300, 'Đối tượng mục tiêu tối đa 300 ký tự'),
  writingStyle: z.string().trim().max(300, 'Phong cách viết tối đa 300 ký tự'),
  keywordsShouldUse: keywordListField('Từ khoá nên dùng'),
  keywordsAvoid: keywordListField('Từ khoá cần tránh'),
  fewShotExamples: z
    .array(fewShotExampleSchema)
    .max(MAX_FEW_SHOT_EXAMPLES, `Tối đa ${MAX_FEW_SHOT_EXAMPLES} bài viết mẫu`),
});

export type BrandVoiceFormValues = z.infer<typeof brandVoiceFormSchema>;
