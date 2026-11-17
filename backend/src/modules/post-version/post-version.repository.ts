import { isDeepStrictEqual } from 'node:util';
import type { Prisma, PostVersionSource } from '@prisma/client';
import prisma from '../../config/db.js';

export const MAX_VERSIONS_PER_POST = 30;

const VERSION_AUTHOR_SELECT = { id: true, name: true, avatar: true } as const;

export interface PostSnapshot {
  id: string;
  title: string;
  content: Prisma.JsonValue;
}

interface VersionMeta {
  userId: string;
  source: PostVersionSource;
}

// Gọi sau khi đã ghi bài trong cùng transaction: UPDATE giữ khoá dòng nên hai lần lưu
// đồng thời xếp hàng, bản sau luôn thấy số version của bản trước.
export const recordPostVersion = async (
  tx: Prisma.TransactionClient,
  post: PostSnapshot,
  { userId, source }: VersionMeta
) => {
  const latest = await tx.postVersion.findFirst({
    where: { postId: post.id },
    orderBy: { version: 'desc' },
    select: { version: true, title: true, content: true },
  });

  if (latest && latest.title === post.title && isDeepStrictEqual(latest.content, post.content)) {
    return null;
  }

  const version = (latest?.version ?? 0) + 1;
  const created = await tx.postVersion.create({
    data: {
      postId: post.id,
      version,
      title: post.title,
      content: post.content as Prisma.InputJsonValue,
      source,
      createdById: userId,
    },
  });

  await tx.postVersion.deleteMany({
    where: { postId: post.id, version: { lte: version - MAX_VERSIONS_PER_POST } },
  });

  return created;
};

export const listPostVersions = async (postId: string) => {
  return prisma.postVersion.findMany({
    where: { postId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      title: true,
      source: true,
      createdAt: true,
      createdBy: { select: VERSION_AUTHOR_SELECT },
    },
  });
};

export const findPostVersion = async (postId: string, version: number) => {
  return prisma.postVersion.findUnique({
    where: { postId_version: { postId, version } },
    select: {
      id: true,
      version: true,
      title: true,
      content: true,
      source: true,
      createdAt: true,
      createdBy: { select: VERSION_AUTHOR_SELECT },
    },
  });
};

export default {
  recordPostVersion,
  listPostVersions,
  findPostVersion,
};
