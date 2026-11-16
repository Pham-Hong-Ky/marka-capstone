import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { personNameSchema, strongPasswordSchema } from '../../utils/validation/common.js';

extendZodWithOpenApi(z);

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const socialUrlSchema = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `Link ${label} tối đa 2048 ký tự`)
    .url(`Link ${label} không hợp lệ`)
    .refine(isHttpUrl, `Link ${label} chỉ hỗ trợ http hoặc https`);

export const updateProfileBodySchema = z.object({
  name: personNameSchema.optional().openapi({ example: 'Nguyễn Văn B' }),

  avatar: z
    .string()
    .url('Đường dẫn ảnh đại diện không hợp lệ')
    .nullable()
    .optional()
    .openapi({ example: 'https://example.com/avatar.jpg' }),

  facebookUrl: socialUrlSchema('Facebook')
    .nullable()
    .optional()
    .openapi({ example: 'https://facebook.com/nguyenvana' }),

  threadsUrl: socialUrlSchema('Threads')
    .nullable()
    .optional()
    .openapi({ example: 'https://www.threads.net/@nguyenvana' }),
});

export const changePasswordBodySchema = z.object({
  oldPassword: z
    .string()
    .min(1, 'Mật khẩu cũ không được để trống')
    .openapi({ example: 'password123' }),

  newPassword: strongPasswordSchema('Mật khẩu mới').openapi({ example: 'newPassword456' }),
});

export const deleteAccountBodySchema = z.object({
  password: z.string().optional().openapi({ example: 'password123' }),
  confirm: z
    .string()
    .refine((value) => value === 'XOA', {
      message: 'Nhập XOA để xác nhận xoá tài khoản',
    }),
});

export const updateProfileSchema = { body: updateProfileBodySchema };
export const changePasswordSchema = { body: changePasswordBodySchema };
export const deleteAccountSchema = { body: deleteAccountBodySchema };

export default {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
};
