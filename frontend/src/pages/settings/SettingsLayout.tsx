import { Outlet } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import TabNav, { type TabNavItem } from '@/components/ui/TabNav';

const SETTINGS_TABS: TabNavItem[] = [
  { label: 'Tài khoản', to: '/settings/account' },
  { label: 'Giao diện', to: '/settings/appearance' },
  { label: 'Workspace', to: '/settings/workspace' },
  { label: 'Thành viên', to: '/settings/members' },
];

export const SettingsLayout = () => (
  <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader
      title="Cài đặt"
      description="Quản lý tài khoản, giao diện, workspace và thành viên."
    />

    <TabNav ariaLabel="Cài đặt" items={SETTINGS_TABS} />

    <Outlet />
  </div>
);

export default SettingsLayout;
