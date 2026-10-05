-- AddPerformanceIndexes
-- Các index phục vụ truy vấn ở quy mô lớn (search, dashboard, filter, badge thông báo).
-- Chạy tự động qua: npx prisma migrate deploy

-- posts: tìm kiếm & lọc theo workspace + trạng thái, có tính soft-delete
CREATE INDEX "posts_workspaceId_status_deletedAt_idx" ON "posts"("workspaceId", "status", "deletedAt");

-- ai_generations: dashboard admin & lịch sử theo workspace
CREATE INDEX "ai_generations_workspaceId_createdAt_idx" ON "ai_generations"("workspaceId", "createdAt");

-- credit_transactions: lịch sử credit & tổng hợp doanh thu
CREATE INDEX "credit_transactions_workspaceId_createdAt_idx" ON "credit_transactions"("workspaceId", "createdAt");

-- notifications: đếm chưa đọc & danh sách inbox
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- orders: danh sách hoá đơn theo workspace
CREATE INDEX "orders_workspaceId_idx" ON "orders"("workspaceId");

-- workspace_invites: lời mời đang chờ theo workspace
CREATE INDEX "workspace_invites_workspaceId_idx" ON "workspace_invites"("workspaceId");
