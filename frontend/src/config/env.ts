import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().url('VITE_API_URL phải là một URL hợp lệ').default('http://localhost:5000/api/v1'),
  VITE_GOOGLE_CLIENT_ID: z.string().default('996593920292-ic4dogjj1iue26phfj9197rhut9p8ijt.apps.googleusercontent.com'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('❌ Lỗi cấu hình biến môi trường Frontend:', parsed.error.flatten().fieldErrors);
  throw new Error('Cấu hình biến môi trường Frontend không hợp lệ');
}

export const env = parsed.data;
export default env;
