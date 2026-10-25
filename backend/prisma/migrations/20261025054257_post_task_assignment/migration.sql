-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "ai_generations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" VARCHAR(36),
ADD COLUMN     "assigneeId" VARCHAR(36),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "taskStatus" "TaskStatus" NOT NULL DEFAULT 'TODO';

-- CreateIndex
CREATE INDEX "posts_workspaceId_assigneeId_taskStatus_idx" ON "posts"("workspaceId", "assigneeId", "taskStatus");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
