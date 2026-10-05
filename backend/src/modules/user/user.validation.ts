import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const updateProfileBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên tối thiểu 2 ký tự')
    .max(100)
    .optional()
    .openapi({ example: 'Nguyễn Văn B' }),

  avatar: z
    .string()
    .url('Đường dẫn ảnh đại diện không hợp lệ')
    .nullable()
    .optional()
    .openapi({ example: 'https://example.com/avatar.jpg' }),
});

export const changePasswordBodySchema = z.object({
  oldPassword: z
    .string()
    .min(1, 'Mật khẩu cũ không được để trống')
    .openapi({ example: 'password123' }),

  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
    .max(100, 'Mật khẩu tối đa 100 ký tự')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số')
    .openapi({ example: 'newPassword456' }),
});

export const updateProfileSchema = { body: updateProfileBodySchema };
export const changePasswordSchema = { body: changePasswordBodySchema };

export default {
  updateProfileSchema,
  changePasswordSchema,
};
