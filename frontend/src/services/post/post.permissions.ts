import type { WorkspaceRole } from '@/services/auth';
import type { PostStatus } from './post.types';

interface PostOwnership {
  status: PostStatus;
  createdById: string | null;
}

export const canManagePost = (
  post: Pick<PostOwnership, 'createdById'>,
  userId: string | null,
  role: WorkspaceRole
): boolean => role === 'OWNER' || (Boolean(userId) && post.createdById === userId);

// Gửi duyệt và xoá: chỉ người tạo hoặc Owner, khi bài là Nháp hoặc Bị từ chối.
export const canModifyPost = (
  post: PostOwnership,
  userId: string | null,
  role: WorkspaceRole
): boolean => {
  if (post.status !== 'DRAFT' && post.status !== 'REJECTED') {
    return false;
  }

  return canManagePost(post, userId, role);
};

// Sửa nội dung: Nháp thì mọi thành viên workspace, Bị từ chối thì người tạo hoặc Owner.
export const canEditPost = (
  post: PostOwnership,
  userId: string | null,
  role: WorkspaceRole
): boolean => post.status === 'DRAFT' || canModifyPost(post, userId, role);

export default canModifyPost;
