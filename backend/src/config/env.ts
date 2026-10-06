import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL là bắt buộc'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET tối thiểu 32 ký tự'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET tối thiểu 32 ký tự'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  AES_SECRET_KEY: z.string().min(32, 'AES_SECRET_KEY tối thiểu 32 ký tự'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().default(process.env.CLIENT_ID || ''),
  GOOGLE_CLIENT_SECRET: z.string().default(process.env.CLIENT_SECRET || ''),

  // Background workers (BullMQ). Dev: true (chạy kèm API). Production: false (worker chạy service riêng).
  ENABLE_WORKERS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // ---- Third-party integrations (tuỳ chọn; điền ở .env khi dùng) ----
  OPENAI_API_KEY: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  PAYOS_CLIENT_ID: z.string().default(''),
  PAYOS_API_KEY: z.string().default(''),
  PAYOS_CHECKSUM_KEY: z.string().default(''),
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z.string().default('no-reply@marka.vn'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Lỗi cấu hình biến môi trường:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export default env;
