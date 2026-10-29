-- AlterTable
ALTER TABLE "channel_connections" ADD COLUMN     "label" VARCHAR(255);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3);
