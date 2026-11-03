import { execSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.test' });

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!databaseUrl.includes('_test')) {
  console.error(
    'DATABASE_URL của môi trường test phải trỏ tới database/schema có chứa "_test". ' +
      'Sao chép backend/.env.test.example thành backend/.env.test rồi chạy lại.'
  );
  process.exit(1);
}

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: process.env,
});
