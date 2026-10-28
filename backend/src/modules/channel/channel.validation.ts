import { SocialPlatform } from '@prisma/client';
import { workspaceIdField, workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const listChannelsSchema = { params: workspaceIdParamSchema };

export const platformParamSchema = z.object({
  platform: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.nativeEnum(SocialPlatform)),
});

export const oauthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_reason: z.string().optional(),
});

export const channelIdParamSchema = z.object({
  channelId: z.string().uuid('Channel ID không hợp lệ'),
});

export const channelIdSchema = { params: channelIdParamSchema };

export const channelProfileParamSchema = z.object({
  workspaceId: workspaceIdField,
  channelId: z.string().uuid('Channel ID không hợp lệ'),
});

export const updateChannelLabelBodySchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Tên hiển thị không được để trống')
    .max(100, 'Tên hiển thị tối đa 100 ký tự')
    .nullable(),
});

export const channelProfileSchema = { params: channelProfileParamSchema };

export const updateChannelLabelSchema = {
  params: channelProfileParamSchema,
  body: updateChannelLabelBodySchema,
};

export const oauthSessionParamSchema = z.object({
  sessionId: z.string().regex(/^[a-f0-9]{48}$/, 'Phiên kết nối không hợp lệ'),
});

export const connectAccountsBodySchema = z.object({
  accountIds: z
    .array(z.string().min(1))
    .min(1, 'Chọn ít nhất một tài khoản')
    .max(50, 'Chỉ được kết nối tối đa 50 tài khoản mỗi lần'),
});

export const oauthUrlSchema = {
  params: platformParamSchema,
  query: z.object({ workspaceId: workspaceIdField }),
};

export const oauthCallbackSchema = {
  params: platformParamSchema,
  query: oauthCallbackQuerySchema,
};

export const oauthSessionSchema = {
  params: platformParamSchema.merge(oauthSessionParamSchema),
};

export const connectAccountsSchema = {
  params: platformParamSchema.merge(oauthSessionParamSchema),
  body: connectAccountsBodySchema,
};

export default {
  listChannelsSchema,
  oauthUrlSchema,
  oauthCallbackSchema,
  oauthSessionSchema,
  connectAccountsSchema,
};
