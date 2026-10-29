-- Ngắt kết nối kênh theo hướng mềm để giữ lịch sử đăng bài và metric.
ALTER TABLE "channel_connections" ADD COLUMN "deletedAt" TIMESTAMP(3);
