import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { workspaceIdParamSchema } from '../../utils/validation/common.js';

extendZodWithOpenApi(z);

const brandVoiceKeywordSchema = z
  .string()
  .trim()
  .min(1, 'Từ khoá không được để trống')
  .max(50, 'Từ khoá tối đa 50 ký tự')
  .openapi({ example: 'thanh lịch' });

const brandVoiceKeywordsSchema = (label: string) =>
  z.array(brandVoiceKeywordSchema).max(30, `${label} tối đa 30 từ khoá`).default([]);

const brandVoiceExampleSchema = z.object({
  title: z.string().trim().max(100, 'Tiêu đề bài mẫu tối đa 100 ký tự').optional(),
  content: z
    .string()
    .trim()
    .min(10, 'Nội dung bài mẫu tối thiểu 10 ký tự')
    .max(5000, 'Nội dung bài mẫu tối đa 5000 ký tự')
    .openapi({ example: 'Chỉ một chiếc sơ mi trắng cũng đủ cho cả tuần đi làm của bạn.' }),
});

export const brandVoiceBodySchema = z.object({
  industry: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập ngành hàng')
    .max(100, 'Ngành hàng tối đa 100 ký tự')
    .openapi({ example: 'Thời trang nữ' }),
  targetAudience: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập đối tượng mục tiêu')
    .max(300, 'Đối tượng mục tiêu tối đa 300 ký tự')
    .openapi({ example: 'Nữ 22-30 tuổi tại Hà Nội' }),
  writingStyle: z
    .string()
    .trim()
    .max(300, 'Phong cách viết tối đa 300 ký tự')
    .default('')
    .openapi({ example: 'Thân thiện, gần gũi, hạn chế thuật ngữ chuyên ngành' }),
  keywordsShouldUse: brandVoiceKeywordsSchema('Từ khoá nên dùng'),
  keywordsAvoid: brandVoiceKeywordsSchema('Từ khoá cần tránh'),
  fewShotExamples: z.array(brandVoiceExampleSchema).max(3, 'Tối đa 3 bài viết mẫu').default([]),
});

export type BrandVoiceInput = z.infer<typeof brandVoiceBodySchema>;

export const brandVoiceInsightsQuerySchema = z.object({
  windowDays: z.coerce
    .number()
    .int('Số ngày phải là số nguyên')
    .min(7, 'Cần ít nhất 7 ngày dữ liệu')
    .max(365, 'Tối đa 365 ngày')
    .default(90)
    .openapi({ example: 90 }),
  limit: z.coerce
    .number()
    .int('Số bài phải là số nguyên')
    .min(1, 'Cần ít nhất 1 bài')
    .max(10, 'Tối đa 10 bài')
    .default(5)
    .openapi({ example: 5 }),
  channelId: z.string().uuid('Channel ID không hợp lệ').optional(),
});

export type BrandVoiceInsightsQuery = z.infer<typeof brandVoiceInsightsQuerySchema>;

export const brandVoiceSchema = { body: brandVoiceBodySchema, params: workspaceIdParamSchema };

export const brandVoiceInsightsSchema = {
  params: workspaceIdParamSchema,
  query: brandVoiceInsightsQuerySchema,
};

export default { brandVoiceSchema, brandVoiceInsightsSchema };
