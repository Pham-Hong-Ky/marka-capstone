import type { ChannelPlatform } from '../channel/channel.types';

type SchedulePostStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'ARCHIVED';

export type ScheduleStatus = 'SCHEDULED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';

export interface ScheduleChannel {
  id: string;
  name: string;
  avatar: string | null;
  externalAccountId: string;
  platform: ChannelPlatform;
  status: 'ACTIVE' | 'EXPIRED';
}

export interface SchedulePostRef {
  id: string;
  title: string;
  status: SchedulePostStatus;
}

export interface ScheduleItem {
  id: string;
  postId: string;
  channelId: string;
  scheduledAt: string | null;
  status: ScheduleStatus;
  externalPostId: string | null;
  errorMessage: string | null;
  retryCount: number;
  retryAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  post: SchedulePostRef;
  channel: ScheduleChannel;
}

export interface ScheduleListParams {
  status?: ScheduleStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ScheduleListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ScheduleListResult {
  schedules: ScheduleItem[];
  meta: ScheduleListMeta;
}

export interface CreateSchedulePayload {
  channelIds: string[];
  scheduledAt?: string | null;
}

export interface CreateScheduleResult {
  schedules: ScheduleItem[];
}
