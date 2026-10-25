import type { PaginationMeta } from '../post/post.types';

export interface NotificationPayload {
  postId?: string;
  postTitle?: string;
  approved?: boolean;
  reason?: string | null;
  submittedById?: string;
  [key: string]: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  payload: NotificationPayload;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  notifications: AppNotification[];
  meta: PaginationMeta;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  workspaceId?: string;
}
