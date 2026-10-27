import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { personNameSchema, strongPasswordSchema } from '../../utils/validation/common.js';

extendZodWithOpenApi(z);

export const registerBodySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email không hợp lệ')
    .openapi({ example: 'user@marka.vn' }),

  password: strongPasswordSchema().openapi({ example: 'password123' }),

  name: personNameSchema.openapi({ example: 'Nguyễn Văn A' }),
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

export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().optional(),
});

export const registerSchema = { body: registerBodySchema };
export const loginSchema = { body: loginBodySchema };
export const googleLoginSchema = { body: googleLoginBodySchema };
export const refreshTokenSchema = { body: refreshTokenBodySchema.optional() };

export default {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  refreshTokenSchema,
};
