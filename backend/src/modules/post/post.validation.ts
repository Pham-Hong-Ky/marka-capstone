import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { PostStatus } from '@prisma/client';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
});

export const postIdParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
  postId: z.string().uuid('Post ID không hợp lệ'),
});

export const postContentSchema = z.record(z.unknown()).openapi({ example: { type: 'doc', content: [] } });

export const createPostBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Tiêu đề không được để trống')
    .max(255, 'Tiêu đề tối đa 255 ký tự')
    .openapi({ example: 'Bài viết giới thiệu sản phẩm' }),
  content: postContentSchema,
});

export const createPostSchema = { body: createPostBodySchema, params: workspaceIdParamSchema };
export const postIdSchema = { params: postIdParamSchema };

export const listPostsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().min(1).optional(),
    status: z.nativeEnum(PostStatus).optional(),
    createdById: z.string().uuid('Người tạo không hợp lệ').optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateTo >= q.dateFrom, {
    message: 'Khoảng ngày không hợp lệ',
    path: ['dateTo'],
  });

export const listPostsSchema = { params: workspaceIdParamSchema, query: listPostsQuerySchema };
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const updatePostBodySchema = z
  .object({
    title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255, 'Tiêu đề tối đa 255 ký tự').optional(),
    content: postContentSchema.optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'Cần cung cấp ít nhất một trường để cập nhật',
  });

export const updatePostSchema = { body: updatePostBodySchema, params: postIdParamSchema };

export const postMediaSchema = { params: postIdParamSchema };

export const postMediaParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
  postId: z.string().uuid('Post ID không hợp lệ'),
  mediaId: z.string().uuid('Media ID không hợp lệ'),
});

export const deletePostMediaSchema = { params: postMediaParamSchema };

export const reviewPostBodySchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    rejectReason: z
      .string()
      .trim()
      .min(3, 'Lý do từ chối tối thiểu 3 ký tự')
      .max(255, 'Lý do từ chối tối đa 255 ký tự')
      .optional(),
  })
  .refine((data) => data.decision !== 'REJECTED' || Boolean(data.rejectReason), {
    message: 'Cần nhập lý do khi từ chối bài viết',
    path: ['rejectReason'],
  });

export const reviewPostSchema = { body: reviewPostBodySchema, params: postIdParamSchema };
export type ReviewPostBody = z.infer<typeof reviewPostBodySchema>;

export default {
  createPostSchema,
  postIdSchema,
  listPostsSchema,
  updatePostSchema,
  postMediaSchema,
  deletePostMediaSchema,
  reviewPostSchema,
  workspaceIdParamSchema,
  postIdParamSchema,
};
