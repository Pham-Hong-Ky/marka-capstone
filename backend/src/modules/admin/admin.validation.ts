import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { SystemRole, WorkspacePlan } from '@prisma/client';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().min(1).optional(),
  systemRole: z.nativeEnum(SystemRole).optional(),
  isSuspended: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('Người dùng không hợp lệ'),
});

export const suspendUserBodySchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(255, 'Lý do tối đa 255 ký tự').optional(),
});

export const listWorkspacesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().min(1).optional(),
  plan: z.nativeEnum(WorkspacePlan).optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export const listUsersSchema = { query: listUsersQuerySchema };
export const suspendUserSchema = { params: userIdParamSchema, body: suspendUserBodySchema };
export const listWorkspacesSchema = { query: listWorkspacesQuerySchema };

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type SuspendUserBody = z.infer<typeof suspendUserBodySchema>;
export type ListWorkspacesQuery = z.infer<typeof listWorkspacesQuerySchema>;

export default {
  listUsersSchema,
  suspendUserSchema,
  listWorkspacesSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  suspendUserBodySchema,
  listWorkspacesQuerySchema,
};
