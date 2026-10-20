import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, 'Tên workspace tối thiểu 2 ký tự')
  .max(100, 'Tên workspace tối đa 100 ký tự')
  .openapi({ example: 'Công ty Truyền thông ABC' });

const workspaceRoleSchema = z.enum(['OWNER', 'CONTENT_CREATOR']).openapi({ example: 'CONTENT_CREATOR' });

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
});

export const memberIdParamSchema = z.object({
  workspaceId: z.string().uuid('Workspace ID không hợp lệ'),
  memberId: z.string().uuid('Member ID không hợp lệ'),
});

export const inviteTokenParamSchema = z.object({
  token: z.string().min(1, 'Token lời mời không hợp lệ'),
});

export const createWorkspaceBodySchema = z.object({
  name: workspaceNameSchema,
});

export const updateWorkspaceBodySchema = z
  .object({
    name: workspaceNameSchema.optional(),
  })
  .refine((data) => data.name !== undefined, {
    message: 'Cần cung cấp tên workspace để cập nhật',
  });

export const inviteMemberBodySchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').max(255).openapi({ example: 'member@marka.vn' }),
  role: workspaceRoleSchema.default('CONTENT_CREATOR'),
});

export const changeMemberRoleBodySchema = z.object({
  role: workspaceRoleSchema,
});

export const createWorkspaceSchema = { body: createWorkspaceBodySchema };
export const updateWorkspaceSchema = { body: updateWorkspaceBodySchema, params: workspaceIdParamSchema };
export const workspaceOnlySchema = { params: workspaceIdParamSchema };
export const inviteMemberSchema = { body: inviteMemberBodySchema, params: workspaceIdParamSchema };
export const memberActionSchema = { params: memberIdParamSchema };
export const changeMemberRoleSchema = { body: changeMemberRoleBodySchema, params: memberIdParamSchema };
export const inviteTokenSchema = { params: inviteTokenParamSchema };

export default {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceOnlySchema,
  inviteMemberSchema,
  memberActionSchema,
  changeMemberRoleSchema,
  inviteTokenSchema,
};
