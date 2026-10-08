import { z } from 'zod';

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, 'Tên workspace tối thiểu 2 ký tự')
  .max(100, 'Tên workspace tối đa 100 ký tự');

export const workspaceNameFormSchema = z.object({
  name: workspaceNameSchema,
});

export type WorkspaceNameFormValues = z.infer<typeof workspaceNameFormSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  role: z.enum(['OWNER', 'CONTENT_CREATOR']),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;
