import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Button from '@/components/ui/Button';
import WorkspaceSwitcher from '@/components/features/workspace/WorkspaceSwitcher';
import CreditUsageCard from './CreditUsageCard';
import UserMenu from './UserMenu';
import { NAV_ITEMS } from '@/config/navigation';
import { useUiStore } from '@/stores/ui.store';
import type { AuthUser, UserWorkspace } from '@/services/auth';
import { cn } from '@/utils/cn';

const MEMBERS_PATH = '/settings/members';
const SETTINGS_PATH = '/settings';

// "Thành viên" là mục con của "Cài đặt" nên phải loại trừ nhau để không cùng active.
const isItemActive = (pathname: string, to: string): boolean => {
  if (to === '/') return pathname === '/';
  if (to === SETTINGS_PATH) {
    return pathname.startsWith(SETTINGS_PATH) && !pathname.startsWith(MEMBERS_PATH);
  }
  return pathname === to || pathname.startsWith(`${to}/`);
};

export const Sidebar = ({
  user,
  workspace,
}: {
  user: AuthUser | null;
  workspace: UserWorkspace | undefined;
}) => {
  const { pathname } = useLocation();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const toggleLabel = collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <div className={cn('flex gap-1 p-3', collapsed ? 'flex-col items-center' : 'items-center')}>
        <WorkspaceSwitcher collapsed={collapsed} />

        <Button
          type="button"
          variant="ghost"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          onClick={toggleSidebar}
          className="h-11 w-11 shrink-0 px-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
          const active = isItemActive(pathname, to);

          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-lg text-sm font-medium transition',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                  : 'text-muted hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {collapsed ? null : label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-3">
        {!collapsed && workspace ? (
          <CreditUsageCard
            remainingCredit={workspace.remainingCredit}
            monthlyQuota={workspace.monthlyQuota}
          />
        ) : null}

        <UserMenu
          name={user?.name ?? ''}
          avatar={user?.avatar}
          role={workspace?.role}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
};

export default Sidebar;
