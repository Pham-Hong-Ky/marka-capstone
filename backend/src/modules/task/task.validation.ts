import { workspaceIdField, workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { TaskStatus } from '@prisma/client';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const taskIdParamSchema = z.object({
  workspaceId: workspaceIdField,
  taskId: z.string().uuid('Task ID không hợp lệ'),
});

export const createTaskBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Tiêu đề không được để trống')
    .max(255, 'Tiêu đề tối đa 255 ký tự')
    .openapi({ example: 'Viết brief chiến dịch ra mắt' }),
  description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').optional(),
  assigneeId: z.string().uuid('Người nhận việc không hợp lệ').optional(),
  dueAt: z.coerce.date().optional(),
});

export const boardQuerySchema = z.object({
  mine: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  search: z.string().trim().min(1).optional(),
});

export const assignTaskBodySchema = z.object({
  assigneeId: z.string().uuid('Người nhận việc không hợp lệ').nullable(),
});

export const updateTaskStatusBodySchema = z.object({
  status: z.nativeEnum(TaskStatus),
});

export const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(255).optional(),
    description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự').optional(),
    dueAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Cần cung cấp ít nhất một trường để cập nhật',
  });

export const linkTaskPostBodySchema = z.object({
  postId: z.string().uuid('Bài viết không hợp lệ').nullable(),
});

export const createTaskSchema = { body: createTaskBodySchema, params: workspaceIdParamSchema };
export const boardSchema = { params: workspaceIdParamSchema, query: boardQuerySchema };
export const assignTaskSchema = { body: assignTaskBodySchema, params: taskIdParamSchema };
export const updateTaskStatusSchema = {
  body: updateTaskStatusBodySchema,
  params: taskIdParamSchema,
};
export const updateTaskSchema = { body: updateTaskBodySchema, params: taskIdParamSchema };
export const linkTaskPostSchema = { body: linkTaskPostBodySchema, params: taskIdParamSchema };
export const taskIdSchema = { params: taskIdParamSchema };

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;
export type BoardQuery = z.infer<typeof boardQuerySchema>;
export type AssignTaskBody = z.infer<typeof assignTaskBodySchema>;
export type UpdateTaskStatusBody = z.infer<typeof updateTaskStatusBodySchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
export type LinkTaskPostBody = z.infer<typeof linkTaskPostBodySchema>;

export default {
  taskIdParamSchema,
  createTaskBodySchema,
  boardQuerySchema,
  updateTaskBodySchema,
  assignTaskBodySchema,
  updateTaskStatusBodySchema,
  linkTaskPostBodySchema,
  createTaskSchema,
  boardSchema,
  updateTaskSchema,
  assignTaskSchema,
  updateTaskStatusSchema,
  linkTaskPostSchema,
  taskIdSchema,
};
