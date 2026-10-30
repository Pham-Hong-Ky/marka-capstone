import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Nạp .env.test trước khi app đọc biến môi trường. CI đã đặt DATABASE_URL
// sẵn nên dotenv không ghi đè; local dùng DB test riêng.
config({ path: '.env.test' });

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl.includes('_test')) {
  throw new Error(
    'Test DB chưa được cấu hình an toàn: DATABASE_URL phải trỏ tới database/schema có chứa "_test". ' +
      'Sao chép backend/.env.test.example thành backend/.env.test rồi chạy lại.'
  );
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
