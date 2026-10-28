import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminRoute from '@/components/auth/AdminRoute';
import GuestRoute from '@/components/auth/GuestRoute';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import AdminLayout from '@/pages/admin/AdminLayout';
import ComingSoonPage from '@/pages/ComingSoonPage';
import RouteErrorPage from '@/pages/RouteErrorPage';
import SettingsLayout from '@/pages/settings/SettingsLayout';

// Mỗi trang là một chunk riêng để bundle đầu không phải tải trình soạn thảo.
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await loader()).default,
});

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', lazy: page(() => import('@/pages/auth/LoginPage')) },
          { path: '/register', lazy: page(() => import('@/pages/auth/RegisterPage')) },
        ],
      },
      {
        path: '/invites/:token',
        lazy: page(() => import('@/pages/InvitePage')),
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/',
            element: <AppLayout />,
            children: [
              { index: true, lazy: page(() => import('@/pages/DashboardPage')) },
              { path: 'analytics', element: <Navigate to="/" replace /> },
              { path: 'posts', lazy: page(() => import('@/pages/PostsPage')) },
              { path: 'posts/new', lazy: page(() => import('@/pages/PostEditorPage')) },
              { path: 'posts/:postId/edit', lazy: page(() => import('@/pages/PostEditorPage')) },
              { path: 'schedule', lazy: page(() => import('@/pages/SchedulePage')) },
              { path: 'channels', lazy: page(() => import('@/pages/ChannelsPage')) },
              {
                path: 'channels/:channelId',
                lazy: page(() => import('@/pages/ChannelDetailPage')),
              },
              { path: 'brand-voice', lazy: page(() => import('@/pages/BrandVoicePage')) },
              { path: 'ai', element: <ComingSoonPage title="Trợ lý AI" /> },
              { path: 'publishing', element: <ComingSoonPage title="Đăng bài đa kênh" /> },
              { path: 'billing', lazy: page(() => import('@/pages/BillingPage')) },
              {
                path: 'admin',
                element: <AdminRoute />,
                children: [
                  {
                    element: <AdminLayout />,
                    children: [
                      { index: true, lazy: page(() => import('@/pages/admin/AdminOverviewPage')) },
                      { path: 'users', lazy: page(() => import('@/pages/admin/AdminUsersPage')) },
                      {
                        path: 'workspaces',
                        lazy: page(() => import('@/pages/admin/AdminWorkspacesPage')),
                      },
                      {
                        path: 'audit-logs',
                        lazy: page(() => import('@/pages/admin/AdminAuditLogsPage')),
                      },
                    ],
                  },
                ],
              },
              {
                path: 'settings',
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <Navigate to="appearance" replace /> },
                  { path: 'account', lazy: page(() => import('@/pages/settings/AccountTab')) },
                  { path: 'appearance', lazy: page(() => import('@/pages/settings/AppearanceTab')) },
                  { path: 'workspace', lazy: page(() => import('@/pages/settings/WorkspaceTab')) },
                  { path: 'members', lazy: page(() => import('@/pages/settings/MembersTab')) },
                ],
              },
              { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
            ],
          },
        ],
      },
    ],
  },
]);

export default router;
