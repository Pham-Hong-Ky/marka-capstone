import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
});

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD')
  .transform((value) => new Date(`${value}T00:00:00+07:00`));

export const analyticsRangeValues = ['7d', '30d', 'mtd', 'lastMonth', 'custom'] as const;

export const analyticsOverviewQuerySchema = z
  .object({
    range: z.enum(analyticsRangeValues).default('7d'),
    from: dateOnlySchema.optional().openapi({ example: '2026-10-01' }),
    to: dateOnlySchema.optional().openapi({ example: '2026-10-25' }),
    channelId: z.string().uuid('Channel ID không hợp lệ').optional(),
    tag: z.string().trim().min(1).max(255).optional(),
  })
  .refine((query) => query.range !== 'custom' || (query.from && query.to), {
    message: 'Cần chọn ngày bắt đầu và ngày kết thúc',
    path: ['from'],
  })
  .refine((query) => !query.from || !query.to || query.to >= query.from, {
    message: 'Khoảng thời gian không hợp lệ',
    path: ['to'],
  });

export const analyticsSuggestionsQuerySchema = z.object({
  channelId: z.string().uuid('Channel ID không hợp lệ').optional(),
});

export const analyticsOverviewSchema = {
  params: workspaceIdParamSchema,
  query: analyticsOverviewQuerySchema,
};

export const analyticsSuggestionsSchema = {
  params: workspaceIdParamSchema,
  query: analyticsSuggestionsQuerySchema,
};

export const analyticsSyncSchema = { params: workspaceIdParamSchema };

export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;
export type AnalyticsSuggestionsQuery = z.infer<typeof analyticsSuggestionsQuerySchema>;

export default {
  analyticsOverviewSchema,
  analyticsSuggestionsSchema,
  analyticsSyncSchema,
};
