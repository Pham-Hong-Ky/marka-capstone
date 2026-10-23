-- Thêm trạng thái đang xử lý cho lịch đăng bài
ALTER TYPE "PublishStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- Mốc claim/recovery và thời điểm đăng thành công
ALTER TABLE "scheduled_posts" ADD COLUMN "processingStartedAt" TIMESTAMP(3);
ALTER TABLE "scheduled_posts" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Mỗi bài chỉ có tối đa một lịch trên một kênh
CREATE UNIQUE INDEX "scheduled_posts_postId_channelId_key" ON "scheduled_posts"("postId", "channelId");
