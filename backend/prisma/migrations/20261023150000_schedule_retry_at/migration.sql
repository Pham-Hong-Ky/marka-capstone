-- Thời điểm thử lại sau lỗi tạm thời, tách khỏi giờ hẹn gốc (scheduledAt)
ALTER TABLE "scheduled_posts" ADD COLUMN "retryAt" TIMESTAMP(3);
