import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registerBodySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email không hợp lệ')
    .openapi({ example: 'user@marka.vn' }),

  password: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .max(100, 'Mật khẩu tối đa 100 ký tự')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số')
    .openapi({ example: 'password123' }),

  name: z
    .string()
    .trim()
    .min(2, 'Tên tối thiểu 2 ký tự')
    .max(100)
    .openapi({ example: 'Nguyễn Văn A' }),
});

export const loginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email không hợp lệ')
    .openapi({ example: 'user@marka.vn' }),

  password: z
    .string()
    .min(1, 'Mật khẩu không được để trống')
    .openapi({ example: 'password123' }),
});

export const googleLoginBodySchema = z.object({
  idToken: z
    .string()
    .min(1, 'Google ID Token là bắt buộc')
    .openapi({ example: 'eyJhbGciOiJSUzI1NiIs...' }),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().optional(),
});

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().optional(),
});

export const registerSchema = { body: registerBodySchema };
export const loginSchema = { body: loginBodySchema };
export const googleLoginSchema = { body: googleLoginBodySchema };
export const logoutSchema = { body: logoutBodySchema.optional() };
export const refreshTokenSchema = { body: refreshTokenBodySchema.optional() };

export default {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  logoutSchema,
  refreshTokenSchema,
};
