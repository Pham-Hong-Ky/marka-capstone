import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import BrandLogo from '@/components/shared/BrandLogo';
import Button from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button.styles';
import WorkspaceSwitcher from '@/components/features/workspace/WorkspaceSwitcher';
import CreditUsageCard from './CreditUsageCard';
import UserMenu from './UserMenu';
import { ADMIN_NAV_ITEM, NAV_ITEMS } from '@/config/navigation';
import type { AuthUser, UserWorkspace } from '@/services/auth';
import { cn } from '@/utils/cn';

const MEMBERS_PATH = '/settings/members';
const SETTINGS_PATH = '/settings';

// "Thành viên" là mục con của "Cài đặt" nên phải loại trừ nhau để không cùng active.
const isItemActive = (pathname: string, to: string): boolean => {
  if (to === '/') return pathname === to;
  if (to === SETTINGS_PATH) {
    return pathname.startsWith(SETTINGS_PATH) && !pathname.startsWith(MEMBERS_PATH);
  }
  return pathname === to || pathname.startsWith(`${to}/`);
};

export const SidebarContent = ({
  user,
  workspace,
  variant,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  user: AuthUser | null;
  workspace: UserWorkspace | undefined;
  variant: 'desktop' | 'mobile';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) => {
  const { pathname } = useLocation();
  const isCollapsed = variant === 'desktop' && collapsed;
  const navItems = user?.systemRole === 'SYSTEM_ADMIN' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  const toggleLabel = isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';

  return (
    <>
      <div
        className={cn(
          'flex gap-2 p-3',
          isCollapsed ? 'flex-col items-center' : 'items-center'
        )}
      >
        <BrandLogo className="h-8 w-8 rounded-lg" />
        {isCollapsed ? null : (
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Marka</span>
        )}

        {variant === 'desktop' ? (
          <Button
            type="button"
            variant="sidebar"
            aria-label={toggleLabel}
            aria-expanded={!isCollapsed}
            title={toggleLabel}
            onClick={onToggleCollapse}
            className={cn('h-11 w-11 shrink-0 px-0', !isCollapsed && 'ml-auto')}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        <WorkspaceSwitcher collapsed={isCollapsed} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {variant === 'mobile' ? (
          <Link
            to="/posts/new"
            onClick={onNavigate}
            className={buttonClasses('primary', 'mb-2 min-h-11 w-full')}
          >
            Tạo bài viết
          </Link>
        ) : null}

        {navItems.map(({ label, to, icon: Icon }) => {
          const active = isItemActive(pathname, to);

          return (
            <Fragment key={to}>
              {to === ADMIN_NAV_ITEM.to ? (
                <div className="my-2 border-t border-sidebar-border" />
              ) : null}
              <Link
                to={to}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                aria-label={isCollapsed ? label : undefined}
                title={isCollapsed ? label : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-lg text-[13px] font-medium transition',
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3 py-2',
                  active
                    ? 'bg-sidebar-active text-sidebar-active-foreground'
                    : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" />
                {isCollapsed ? null : label}
              </Link>
            </Fragment>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        {!isCollapsed && workspace ? (
          <Link
            to="/billing"
            aria-label="Mở trang Gói & Credit"
            className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-active"
          >
            <CreditUsageCard
              remainingCredit={workspace.remainingCredit}
              className="transition hover:border-sidebar-active/60"
            />
          </Link>
        ) : null}

        <UserMenu
          name={user?.name ?? ''}
          avatar={user?.avatar}
          role={workspace?.role}
          collapsed={isCollapsed}
        />
      </div>
    </>
  );
};

export default SidebarContent;
