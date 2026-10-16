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

export interface PostSummary {
  id: string;
  title: string;
  status: PostStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostMedia {
  id: string;
  url: string;
  type: MediaType;
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
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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
