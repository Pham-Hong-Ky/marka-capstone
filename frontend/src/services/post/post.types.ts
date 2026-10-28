import type { PaginationMeta } from '@/types';
import type { ScheduleItem } from '../schedule/schedule.types';

export type { PaginationMeta } from '@/types';

export type PostStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export type MediaType = 'IMAGE' | 'VIDEO';
export type MediaSource = 'UPLOADED' | 'AI_GENERATED';

export interface PostAuthor {
  id: string;
  name: string;
  avatar: string | null;
}

export interface PostSummary {
  id: string;
  title: string;
  status: PostStatus;
  createdById: string | null;
  createdBy: PostAuthor | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostMedia {
  id: string;
  url: string;
  type: MediaType;
  source: MediaSource;
  mimeType: string | null;
  size: number;
  createdAt: string;
}

export interface PostDetail extends PostSummary {
  workspaceId: string;
  content: unknown;
  campaignTag: string | null;
  rejectReason: string | null;
  submittedById: string | null;
  reviewedById: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  mediaAssets: PostMedia[];
  schedules: ScheduleItem[];
}

export interface PostsResult {
  posts: PostSummary[];
  meta: PaginationMeta;
}

export interface PostListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PostStatus;
}

export interface PostContentNode {
  type?: string;
  text?: string;
  content?: PostContentNode[];
}

export interface PostPayload {
  title: string;
  content: object;
}

export interface UpdatePostPayload {
  title?: string;
  content?: object;
}

export interface ReviewPostPayload {
  decision: 'APPROVED' | 'REJECTED';
  rejectReason?: string;
}
