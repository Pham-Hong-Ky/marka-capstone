import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import GuestRoute from '@/components/auth/GuestRoute';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import ComingSoonPage from '@/pages/ComingSoonPage';
import SettingsLayout from '@/pages/settings/SettingsLayout';

// Mỗi trang là một chunk riêng để bundle đầu không phải tải trình soạn thảo.
const page = (loader: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await loader()).default,
});

export const router = createBrowserRouter([
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
          { path: 'posts', lazy: page(() => import('@/pages/PostsPage')) },
          { path: 'posts/new', lazy: page(() => import('@/pages/PostEditorPage')) },
          { path: 'posts/:postId/edit', lazy: page(() => import('@/pages/PostEditorPage')) },
          { path: 'schedule', element: <ComingSoonPage title="Lịch xuất bản" /> },
          { path: 'channels', lazy: page(() => import('@/pages/ChannelsPage')) },
          { path: 'media', element: <ComingSoonPage title="Thư viện Media" /> },
          { path: 'brand-voice', lazy: page(() => import('@/pages/BrandVoicePage')) },
          { path: 'ai', element: <ComingSoonPage title="Trợ lý AI" /> },
          { path: 'publishing', element: <ComingSoonPage title="Đăng bài đa kênh" /> },
          { path: 'billing', element: <ComingSoonPage title="Gói Credit & Nạp" /> },
          {
            path: 'settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="appearance" replace /> },
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
]);

export default router;
