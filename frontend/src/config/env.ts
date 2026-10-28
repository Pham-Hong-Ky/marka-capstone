import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url('VITE_API_URL phải là một URL hợp lệ'),
  VITE_GOOGLE_CLIENT_ID: z.string().min(1, 'VITE_GOOGLE_CLIENT_ID không được để trống'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('❌ Lỗi cấu hình biến môi trường Frontend:', parsed.error.flatten().fieldErrors);
  throw new Error('Cấu hình biến môi trường Frontend không hợp lệ');
}

export const env = parsed.data;
export default env;
