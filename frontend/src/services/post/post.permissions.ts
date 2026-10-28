import type { WorkspaceRole } from '@/services/auth';
import type { PostStatus } from './post.types';

interface PostOwnership {
  status: PostStatus;
  createdById: string | null;
}

export const canModifyPost = (
  post: PostOwnership,
  userId: string | null,
  role: WorkspaceRole
): boolean => {
  if (post.status !== 'DRAFT' && post.status !== 'REJECTED') {
    return false;
  }

  return role === 'OWNER' || (Boolean(userId) && post.createdById === userId);
};

export default canModifyPost;
