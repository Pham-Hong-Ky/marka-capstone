import { workspaceIdField, workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { AI_MAX_IMAGES_PER_REQUEST } from './providers/ai.config.js';

extendZodWithOpenApi(z);

export const generationIdParamSchema = z.object({
  workspaceId: workspaceIdField,
  generationId: z.string().uuid('Generation ID không hợp lệ'),
});

const postContentSchema = z.record(z.unknown()).openapi({
  example: { type: 'doc', content: [{ type: 'paragraph' }] },
});

const promptSchema = z
  .string()
  .trim()
  .max(500, 'Ghi chú cho ảnh tối đa 500 ký tự')
  .optional();

export const generateTextBodySchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, 'Chủ đề tối thiểu 5 ký tự')
    .max(1000, 'Chủ đề tối đa 1000 ký tự')
    .openapi({ example: 'Ra mắt bộ sưu tập áo thu đông cho nữ văn phòng' }),
  instructions: z
    .string()
    .trim()
    .max(500, 'Yêu cầu thêm tối đa 500 ký tự')
    .optional(),
  postId: z.string().uuid('Post ID không hợp lệ').optional(),
  channelIds: z
    .array(z.string().uuid('Channel ID không hợp lệ'))
    .min(1, 'Chọn ít nhất một kênh')
    .max(10, 'Chọn tối đa 10 kênh')
    .optional()
    .openapi({ example: ['3f0c1c1e-7a4b-4c36-9b9c-9f4f0b2d7d10'] }),
});

export const generateImageBodySchema = z.union([
  z.object({
    postId: z.string().uuid('Post ID không hợp lệ'),
    prompt: promptSchema,
  }),
  z.object({
    title: z
      .string()
      .trim()
      .min(1, 'Tiêu đề không được để trống')
      .max(255, 'Tiêu đề tối đa 255 ký tự'),
    content: postContentSchema,
    prompt: promptSchema,
  }),
]);

export const generatePostBodySchema = z
  .object({
    withText: z.boolean().default(true),
    imageCount: z
      .number()
      .int('Số ảnh phải là số nguyên')
      .min(0)
      .max(AI_MAX_IMAGES_PER_REQUEST, `Tối đa ${AI_MAX_IMAGES_PER_REQUEST} ảnh mỗi lần`)
      .default(0),
    topic: generateTextBodySchema.shape.topic.optional(),
    instructions: generateTextBodySchema.shape.instructions,
    channelIds: generateTextBodySchema.shape.channelIds,
    postId: z.string().uuid('Post ID không hợp lệ').optional(),
    title: z.string().trim().min(1).max(255).optional(),
    content: postContentSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.withText && body.imageCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imageCount'],
        message: 'Chọn tạo nội dung hoặc ít nhất một ảnh',
      });
    }
    if (body.withText && !body.topic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['topic'],
        message: 'Chủ đề tối thiểu 5 ký tự',
      });
    }
    if (!body.withText && !body.postId && !(body.title && body.content)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postId'],
        message: 'Cần chọn bài viết hoặc có tiêu đề và nội dung để tạo ảnh',
      });
    }
  });

export const generateTextSchema = {
  body: generateTextBodySchema,
  params: workspaceIdParamSchema,
};

export const generatePostSchema = {
  body: generatePostBodySchema,
  params: workspaceIdParamSchema,
};

export const generateImageSchema = {
  body: generateImageBodySchema,
  params: workspaceIdParamSchema,
};

export const generationIdSchema = { params: generationIdParamSchema };

export const listGenerationsQuerySchema = z.object({
  ids: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    )
    .pipe(
      z
        .array(z.string().uuid('Generation ID không hợp lệ'))
        .min(1, 'Cần ít nhất một generation')
        .max(AI_MAX_IMAGES_PER_REQUEST + 1, 'Quá nhiều generation trong một lần hỏi')
    ),
});

export const listGenerationsSchema = {
  params: workspaceIdParamSchema,
  query: listGenerationsQuerySchema,
};

export type GenerateTextBody = z.infer<typeof generateTextBodySchema>;
export type GenerateImageBody = z.infer<typeof generateImageBodySchema>;
export type GeneratePostBody = z.infer<typeof generatePostBodySchema>;
export type ListGenerationsQuery = z.infer<typeof listGenerationsQuerySchema>;

export default {
  generateTextSchema,
  generateImageSchema,
  generatePostSchema,
  generationIdSchema,
  listGenerationsSchema,
  workspaceIdParamSchema,
  generationIdParamSchema,
};
