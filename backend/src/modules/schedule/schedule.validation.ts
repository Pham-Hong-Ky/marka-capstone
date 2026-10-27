import { workspaceIdField, workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { PublishStatus } from '@prisma/client';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const postScheduleParamSchema = z.object({
  workspaceId: workspaceIdField,
  postId: z.string().uuid('Post ID không hợp lệ'),
});

export const scheduleIdParamSchema = z.object({
  workspaceId: workspaceIdField,
  scheduleId: z.string().uuid('Schedule ID không hợp lệ'),
});

export const createScheduleBodySchema = z.object({
  channelIds: z
    .array(z.string().uuid('Channel ID không hợp lệ'))
    .min(1, 'Chọn ít nhất một kênh')
    .max(10, 'Chỉ được chọn tối đa 10 kênh')
    .openapi({ example: ['00000000-0000-0000-0000-000000000000'] }),
  scheduledAt: z.coerce.date().nullable().optional().openapi({
    example: '2026-10-24T09:00:00.000Z',
    description: 'Bỏ trống hoặc null để đăng ngay',
  }),
});

export const createScheduleSchema = {
  params: postScheduleParamSchema,
  body: createScheduleBodySchema,
};

export const listSchedulesQuerySchema = z
  .object({
    status: z.nativeEnum(PublishStatus).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(20),
  })
  .refine((query) => !query.from || !query.to || query.to >= query.from, {
    message: 'Khoảng thời gian không hợp lệ',
    path: ['to'],
  });

export const listSchedulesSchema = {
  params: workspaceIdParamSchema,
  query: listSchedulesQuerySchema,
};

export const scheduleIdSchema = { params: scheduleIdParamSchema };

export type CreateScheduleBody = z.infer<typeof createScheduleBodySchema>;
export type ListSchedulesQuery = z.infer<typeof listSchedulesQuerySchema>;

export default {
  createScheduleSchema,
  listSchedulesSchema,
  scheduleIdSchema,
};
