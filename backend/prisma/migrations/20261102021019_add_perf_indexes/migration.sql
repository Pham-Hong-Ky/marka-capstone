-- CreateIndex
CREATE INDEX "notifications_userId_type_idx" ON "notifications"("userId", "type");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_publishedAt_idx" ON "scheduled_posts"("status", "publishedAt");
