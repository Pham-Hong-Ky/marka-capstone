import { Outlet } from 'react-router-dom';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import PageContainer from '@/components/ui/PageContainer';
import PageHeader from '@/components/ui/PageHeader';
import TabNav, { type TabNavItem } from '@/components/ui/TabNav';

const SETTINGS_TABS: TabNavItem[] = [
  { label: 'Tài khoản', to: '/settings/account' },
  { label: 'Giao diện', to: '/settings/appearance' },
  { label: 'Workspace', to: '/settings/workspace' },
  { label: 'Thành viên', to: '/settings/members' },
];

const OWNER_TABS: TabNavItem[] = [{ label: 'Lịch sử hoạt động', to: '/settings/activity' }];

export const SettingsLayout = () => {
  const isOwner = useActiveWorkspace()?.role === 'OWNER';
  const tabs = isOwner ? [...SETTINGS_TABS, ...OWNER_TABS] : SETTINGS_TABS;

  return (
    <PageContainer width="default">
      <PageHeader
        title="Cài đặt"
        description="Quản lý tài khoản, giao diện, workspace và thành viên."
      />

      <div className="lg:hidden">
        <TabNav ariaLabel="Cài đặt" items={tabs} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <TabNav ariaLabel="Cài đặt" items={tabs} orientation="vertical" />
          </div>
        </aside>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  );
};

export default SettingsLayout;
