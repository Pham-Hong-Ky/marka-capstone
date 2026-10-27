import { Outlet } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import TabNav, { type TabNavItem } from '@/components/ui/TabNav';

const ADMIN_TABS: TabNavItem[] = [
  { label: 'Tổng quan', to: '/admin', end: true },
  { label: 'Người dùng', to: '/admin/users' },
  { label: 'Workspace', to: '/admin/workspaces' },
  { label: 'Audit log', to: '/admin/audit-logs' },
];

export const AdminLayout = () => (
  <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader
      title="Quản trị hệ thống"
      description="Theo dõi và quản lý toàn bộ người dùng, workspace và hoạt động hệ thống."
    />

    <TabNav ariaLabel="Quản trị" items={ADMIN_TABS} />

    <Outlet />
  </div>
);

export default AdminLayout;
