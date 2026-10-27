import { workspaceIdField, workspaceIdParamSchema } from '../../utils/validation/common.js';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const listChannelsSchema = { params: workspaceIdParamSchema };

export const facebookOauthUrlQuerySchema = z.object({
  workspaceId: workspaceIdField,
});

export const facebookCallbackQuerySchema = z.object({
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

export const connectFacebookPagesBodySchema = z.object({
  pageIds: z
    .array(z.string().min(1))
    .min(1, 'Chọn ít nhất một Page')
    .max(50, 'Chỉ được kết nối tối đa 50 Page mỗi lần'),
});

export const facebookOauthUrlSchema = { query: facebookOauthUrlQuerySchema };
export const facebookCallbackSchema = { query: facebookCallbackQuerySchema };
export const oauthSessionSchema = { params: oauthSessionParamSchema };
export const connectFacebookSchema = {
  params: oauthSessionParamSchema,
  body: connectFacebookPagesBodySchema,
};

export default {
  listChannelsSchema,
  facebookOauthUrlSchema,
  facebookCallbackSchema,
  oauthSessionSchema,
  connectFacebookSchema,
};
