import type { WorkspaceRole } from '@prisma/client';
import { NotFoundError } from '../../utils/errors/index.js';
import postService, { assertCanEdit, recordPostEdit } from '../post/post.service.js';
import postRepository from '../post/post.repository.js';
import postVersionRepository from './post-version.repository.js';

export const listVersions = async (workspaceId: string, postId: string) => {
  await postService.getPost(workspaceId, postId);
  return postVersionRepository.listPostVersions(postId);
};

const getVersionOrThrow = async (postId: string, version: number) => {
  const found = await postVersionRepository.findPostVersion(postId, version);
  if (!found) {
    throw new NotFoundError('Phiên bản bài viết không tồn tại');
  }
  return found;
};

export const getVersion = async (workspaceId: string, postId: string, version: number) => {
  await postService.getPost(workspaceId, postId);
  return getVersionOrThrow(postId, version);
};

export const restoreVersion = async (
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  postId: string,
  version: number
) => {
  const post = await postService.getPost(workspaceId, postId);
  assertCanEdit(post, userId, role);

  const target = await getVersionOrThrow(postId, version);

  const restored = await postRepository.updatePost(
    postId,
    { title: target.title, content: target.content as object },
    { userId, source: 'RESTORE' }
  );
  await recordPostEdit(workspaceId, userId, restored, `restoreVersion:${version}`);

  return restored;
};

export default {
  listVersions,
  getVersion,
  restoreVersion,
};
