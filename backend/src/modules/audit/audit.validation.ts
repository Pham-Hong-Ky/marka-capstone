import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const auditLogsQueryBase = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  actorId: z.string().uuid('Người thực hiện không hợp lệ').optional(),
  action: z.string().trim().min(1).max(100).optional(),
  targetType: z.string().trim().min(1).max(100).optional(),
  targetId: z.string().trim().min(1).max(255).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const withDateRange = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (query) => {
      const value = query as { dateFrom?: Date; dateTo?: Date };
      return !value.dateFrom || !value.dateTo || value.dateTo >= value.dateFrom;
    },
    { message: 'Khoảng ngày không hợp lệ', path: ['dateTo'] }
  );

export const adminAuditLogsQuerySchema = withDateRange(
  auditLogsQueryBase.extend({
    workspaceId: z.string().uuid('Workspace ID không hợp lệ').optional(),
  })
);

export const workspaceAuditLogsQuerySchema = withDateRange(auditLogsQueryBase);

export const auditWorkspaceParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
});

export const adminAuditLogsSchema = { query: adminAuditLogsQuerySchema };
export const workspaceAuditLogsSchema = {
  params: auditWorkspaceParamSchema,
  query: workspaceAuditLogsQuerySchema,
};

export type AdminAuditLogsQuery = z.infer<typeof adminAuditLogsQuerySchema>;
export type WorkspaceAuditLogsQuery = z.infer<typeof workspaceAuditLogsQuerySchema>;

export default {
  adminAuditLogsSchema,
  workspaceAuditLogsSchema,
  adminAuditLogsQuerySchema,
  workspaceAuditLogsQuerySchema,
  auditWorkspaceParamSchema,
};
