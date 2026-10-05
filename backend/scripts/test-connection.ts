import prisma from '../src/config/db.js';
import { cacheConnection, queueConnection } from '../src/config/redis.js';

const toMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function runDiagnostics() {
  console.log('\n================ KIỂM TRA KẾT NỐI HỆ THỐNG ================\n');

  try {
    const dbPromise = prisma.$queryRaw`SELECT 1 as result`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout 5s khi kết nối PostgreSQL')), 5000)
    );
    const dbResult = await Promise.race([dbPromise, timeoutPromise]);
    console.log('✅ PostgreSQL Database: KẾT NỐI THÀNH CÔNG (Query SELECT 1 OK)', dbResult);
  } catch (err) {
    console.error('❌ PostgreSQL Database: KẾT NỐI THẤT BẠI:', toMessage(err));
  }

  try {
    const pingPromise = cacheConnection.ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout 3s khi kết nối Redis Cache')), 3000)
    );
    const cachePing = await Promise.race([pingPromise, timeoutPromise]);
    console.log(`✅ Redis Cache Connection: KẾT NỐI THÀNH CÔNG (PING -> ${cachePing})`);
  } catch (err) {
    console.error('❌ Redis Cache Connection: KẾT NỐI THẤT BẠI:', toMessage(err));
  }

  try {
    const queuePromise = queueConnection.ping();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout 3s khi kết nối Redis Queue')), 3000)
    );
    const queuePing = await Promise.race([queuePromise, timeoutPromise]);
    console.log(`✅ Redis Queue Connection (BullMQ): KẾT NỐI THÀNH CÔNG (PING -> ${queuePing})`);
  } catch (err) {
    console.error(`❌ Redis Queue Connection (BullMQ): KẾT NỐI THẤT BẠI: ${toMessage(err)}`);
  }

  console.log('\n===========================================================\n');

  try {
    await prisma.$disconnect();
  } catch (err) {
    console.warn('⚠️ Không thể đóng kết nối Prisma:', toMessage(err));
  }

  try {
    cacheConnection.disconnect();
    queueConnection.disconnect();
  } catch (err) {
    console.warn('⚠️ Không thể đóng kết nối Redis:', toMessage(err));
  }

  process.exit(0);
}

runDiagnostics();
