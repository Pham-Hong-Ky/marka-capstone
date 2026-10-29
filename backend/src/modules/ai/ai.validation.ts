import { workspaceIdField, workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

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

export const generateTextSchema = {
  body: generateTextBodySchema,
  params: workspaceIdParamSchema,
};

export const generateImageSchema = {
  body: generateImageBodySchema,
  params: workspaceIdParamSchema,
};

export const generationIdSchema = { params: generationIdParamSchema };

export type GenerateTextBody = z.infer<typeof generateTextBodySchema>;
export type GenerateImageBody = z.infer<typeof generateImageBodySchema>;

export default {
  generateTextSchema,
  generateImageSchema,
  generationIdSchema,
  workspaceIdParamSchema,
  generationIdParamSchema,
};
