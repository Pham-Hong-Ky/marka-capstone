import {
  AudioLines,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Settings,
  Share2,
  ShieldCheck,
  SquareKanban,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { matchPath } from 'react-router-dom';

export const ROUTE_LABELS = {
  dashboard: 'Tổng quan',
  posts: 'Bài viết',
  tasks: 'Công việc',
  postCreate: 'Tạo bài viết',
  postEdit: 'Sửa bài viết',
  schedule: 'Lịch xuất bản',
  channels: 'Kênh kết nối',
  channelDetail: 'Chi tiết kênh',
  brandVoice: 'Brand Voice',
  members: 'Thành viên',
  billing: 'Credit & Nạp',
  settings: 'Cài đặt',
  account: 'Tài khoản',
  appearance: 'Giao diện',
  workspace: 'Workspace',
  admin: 'Quản trị',
  adminUsers: 'Người dùng',
  adminWorkspaces: 'Workspace',
  adminAuditLogs: 'Audit log',
} as const;

export const MOBILE_NAV_ID = 'mobile-nav';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: ROUTE_LABELS.dashboard, to: '/', icon: LayoutDashboard },
  { label: ROUTE_LABELS.posts, to: '/posts', icon: FileText },
  { label: ROUTE_LABELS.tasks, to: '/tasks', icon: SquareKanban },
  { label: ROUTE_LABELS.schedule, to: '/schedule', icon: CalendarDays },
  { label: ROUTE_LABELS.channels, to: '/channels', icon: Share2 },
  { label: ROUTE_LABELS.brandVoice, to: '/brand-voice', icon: AudioLines },
  { label: ROUTE_LABELS.members, to: '/settings/members', icon: Users },
  { label: ROUTE_LABELS.billing, to: '/billing', icon: Wallet },
  { label: ROUTE_LABELS.settings, to: '/settings', icon: Settings },
];

export const ADMIN_NAV_ITEM: NavItem = {
  label: ROUTE_LABELS.admin,
  to: '/admin',
  icon: ShieldCheck,
};

export interface Breadcrumb {
  label: string;
  to?: string;
}

const POSTS_CRUMB: Breadcrumb = { label: ROUTE_LABELS.posts, to: '/posts' };
const CHANNELS_CRUMB: Breadcrumb = { label: ROUTE_LABELS.channels, to: '/channels' };
const SETTINGS_CRUMB: Breadcrumb = { label: ROUTE_LABELS.settings, to: '/settings' };
const ADMIN_CRUMB: Breadcrumb = { label: ROUTE_LABELS.admin, to: '/admin' };

const BREADCRUMB_ROUTES: Array<{ path: string; crumbs: Breadcrumb[] }> = [
  { path: '/', crumbs: [{ label: ROUTE_LABELS.dashboard }] },
  { path: '/posts', crumbs: [{ label: ROUTE_LABELS.posts }] },
  { path: '/tasks', crumbs: [{ label: ROUTE_LABELS.tasks }] },
  { path: '/posts/new', crumbs: [POSTS_CRUMB, { label: ROUTE_LABELS.postCreate }] },
  { path: '/posts/:postId/edit', crumbs: [POSTS_CRUMB, { label: ROUTE_LABELS.postEdit }] },
  { path: '/schedule', crumbs: [{ label: ROUTE_LABELS.schedule }] },
  { path: '/channels', crumbs: [CHANNELS_CRUMB] },
  { path: '/channels/:channelId', crumbs: [CHANNELS_CRUMB, { label: ROUTE_LABELS.channelDetail }] },
  { path: '/brand-voice', crumbs: [{ label: ROUTE_LABELS.brandVoice }] },
  { path: '/billing', crumbs: [{ label: ROUTE_LABELS.billing }] },
  { path: '/settings', crumbs: [SETTINGS_CRUMB] },
  { path: '/settings/account', crumbs: [SETTINGS_CRUMB, { label: ROUTE_LABELS.account }] },
  { path: '/settings/appearance', crumbs: [SETTINGS_CRUMB, { label: ROUTE_LABELS.appearance }] },
  { path: '/settings/workspace', crumbs: [SETTINGS_CRUMB, { label: ROUTE_LABELS.workspace }] },
  { path: '/settings/members', crumbs: [SETTINGS_CRUMB, { label: ROUTE_LABELS.members }] },
  { path: '/admin', crumbs: [{ label: ROUTE_LABELS.admin }] },
  { path: '/admin/users', crumbs: [ADMIN_CRUMB, { label: ROUTE_LABELS.adminUsers }] },
  { path: '/admin/workspaces', crumbs: [ADMIN_CRUMB, { label: ROUTE_LABELS.adminWorkspaces }] },
  { path: '/admin/audit-logs', crumbs: [ADMIN_CRUMB, { label: ROUTE_LABELS.adminAuditLogs }] },
];

export const resolveBreadcrumbs = (pathname: string): Breadcrumb[] =>
  BREADCRUMB_ROUTES.find((route) => matchPath({ path: route.path, end: true }, pathname))?.crumbs ??
  [];
