import { createBrowserRouter, Navigate } from 'react-router-dom';
import GuestRoute from '@/components/auth/GuestRoute';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ComingSoonPage from '@/pages/ComingSoonPage';
import InvitePage from '@/pages/InvitePage';
import SettingsLayout from '@/pages/settings/SettingsLayout';
import AppearanceTab from '@/pages/settings/AppearanceTab';
import WorkspaceTab from '@/pages/settings/WorkspaceTab';
import MembersTabPage from '@/pages/settings/MembersTab';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    path: '/invites/:token',
    element: <InvitePage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'posts', element: <ComingSoonPage title="Nội dung" /> },
          { path: 'ai', element: <ComingSoonPage title="Trợ lý AI" /> },
          { path: 'publishing', element: <ComingSoonPage title="Đăng bài đa kênh" /> },
          { path: 'billing', element: <ComingSoonPage title="Credit & Gói dịch vụ" /> },
          {
            path: 'settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="appearance" replace /> },
              { path: 'appearance', element: <AppearanceTab /> },
              { path: 'workspace', element: <WorkspaceTab /> },
              { path: 'members', element: <MembersTabPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export default router;
