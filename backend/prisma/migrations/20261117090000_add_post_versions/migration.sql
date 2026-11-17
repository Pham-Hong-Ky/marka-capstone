-- CreateEnum
CREATE TYPE "PostVersionSource" AS ENUM ('MANUAL', 'RESTORE');

-- CreateTable
CREATE TABLE "post_versions" (
    "id" VARCHAR(36) NOT NULL,
    "postId" VARCHAR(36) NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "source" "PostVersionSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" VARCHAR(36),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_versions_postId_version_key" ON "post_versions"("postId", "version");

-- AddForeignKey
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
