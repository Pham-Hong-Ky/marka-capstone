import { Outlet } from 'react-router-dom';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import TabNav, { type TabNavItem } from '@/components/ui/TabNav';

const SETTINGS_TABS: TabNavItem[] = [
  { label: 'Tài khoản', to: '/settings/account' },
  { label: 'Giao diện', to: '/settings/appearance' },
  { label: 'Workspace', to: '/settings/workspace' },
  { label: 'Thành viên', to: '/settings/members' },
];

export const SettingsLayout = () => (
  <PageContainer width="default">
    <PageHeader
      title="Cài đặt"
      description="Quản lý tài khoản, giao diện, workspace và thành viên."
    />

    <div className="lg:hidden">
      <TabNav ariaLabel="Cài đặt" items={SETTINGS_TABS} />
    </div>

    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <TabNav ariaLabel="Cài đặt" items={SETTINGS_TABS} orientation="vertical" />
        </div>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  </PageContainer>
);

export default SettingsLayout;
