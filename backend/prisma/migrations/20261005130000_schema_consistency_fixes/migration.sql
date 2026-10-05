-- SchemaConsistencyFixes
-- Đồng bộ schema với docs/design-decisions.md (D1–D9)

-- D3: trạng thái huỷ lịch đăng
ALTER TYPE "PublishStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- D6/D7: Workspace — mốc chu kỳ billing & cờ chống gửi trùng email
ALTER TABLE "workspaces" ADD COLUMN "billingCycleStart" TIMESTAMP(3);
ALTER TABLE "workspaces" ADD COLUMN "nextResetAt" TIMESTAMP(3);
ALTER TABLE "workspaces" ADD COLUMN "planExpiryWarningSentAt" TIMESTAMP(3);
ALTER TABLE "workspaces" ADD COLUMN "creditWarningSentAt" TIMESTAMP(3);

-- D2: Post — người tạo bài
ALTER TABLE "posts" ADD COLUMN "createdById" VARCHAR(36);
ALTER TABLE "posts" ADD CONSTRAINT "posts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "posts_createdById_idx" ON "posts"("createdById");

-- D1: MediaAsset — thư viện cấp Workspace, postId tùy chọn, xóa mềm
ALTER TABLE "media_assets" ADD COLUMN "workspaceId" VARCHAR(36);
UPDATE "media_assets" m SET "workspaceId" = p."workspaceId" FROM "posts" p WHERE m."postId" = p."id";
ALTER TABLE "media_assets" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "media_assets" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "media_assets" ALTER COLUMN "postId" DROP NOT NULL;
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_postId_fkey";
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "media_assets_workspaceId_idx" ON "media_assets"("workspaceId");

-- D7/D8: ScheduledPost — cờ nhắc lịch + index theo kênh/bài
ALTER TABLE "scheduled_posts" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
CREATE INDEX "scheduled_posts_channelId_idx" ON "scheduled_posts"("channelId");
CREATE INDEX "scheduled_posts_postId_idx" ON "scheduled_posts"("postId");

-- D4: Order — idempotency PayOS theo mã giao dịch
CREATE UNIQUE INDEX "orders_payosTransId_key" ON "orders"("payosTransId");

-- D8: Audit log — index theo workspace & actor
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt");
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- D5: PostMetric (Phân hệ 8 — Post Analytics)
CREATE TABLE "post_metrics" (
    "id" VARCHAR(36) NOT NULL,
    "scheduledPostId" VARCHAR(36) NOT NULL,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "reactionsDetail" JSONB,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "impressions" INTEGER,
    "permalinkUrl" VARCHAR(255),
    "syncError" VARCHAR(255),
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "post_metrics_scheduledPostId_key" ON "post_metrics"("scheduledPostId");
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_scheduledPostId_fkey" FOREIGN KEY ("scheduledPostId") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
