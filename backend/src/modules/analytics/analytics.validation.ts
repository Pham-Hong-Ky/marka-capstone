import { workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

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

export const analyticsPostSortValues = ['publishedAt', 'impressions', 'engagement'] as const;

export const analyticsPostsQuerySchema = analyticsOverviewQuerySchema.and(
  z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    sort: z.enum(analyticsPostSortValues).default('publishedAt'),
  })
);

export const analyticsSuggestionsQuerySchema = z.object({
  channelId: z.string().uuid('Channel ID không hợp lệ').optional(),
});

export const analyticsOverviewSchema = {
  params: workspaceIdParamSchema,
  query: analyticsOverviewQuerySchema,
};

export const analyticsPostsSchema = {
  params: workspaceIdParamSchema,
  query: analyticsPostsQuerySchema,
};

export const analyticsSuggestionsSchema = {
  params: workspaceIdParamSchema,
  query: analyticsSuggestionsQuerySchema,
};

export const analyticsSyncSchema = { params: workspaceIdParamSchema };

export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;
export type AnalyticsPostsQuery = z.infer<typeof analyticsPostsQuerySchema>;
export type AnalyticsSuggestionsQuery = z.infer<typeof analyticsSuggestionsQuerySchema>;

export default {
  analyticsOverviewSchema,
  analyticsPostsSchema,
  analyticsSuggestionsSchema,
  analyticsSyncSchema,
};
