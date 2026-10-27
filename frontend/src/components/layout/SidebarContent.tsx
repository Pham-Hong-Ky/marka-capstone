import { Link, useLocation } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Button from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button.styles';
import WorkspaceSwitcher from '@/components/features/workspace/WorkspaceSwitcher';
import CreditUsageCard from './CreditUsageCard';
import UserMenu from './UserMenu';
import { NAV_ITEMS } from '@/config/navigation';
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

  const toggleLabel = isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';

  return (
    <>
      <div className={cn('flex gap-1 p-3', isCollapsed ? 'flex-col items-center' : 'items-center')}>
        <WorkspaceSwitcher collapsed={isCollapsed} />

        {variant === 'desktop' ? (
          <Button
            type="button"
            variant="ghost"
            aria-label={toggleLabel}
            aria-expanded={!isCollapsed}
            title={toggleLabel}
            onClick={onToggleCollapse}
            className="h-11 w-11 shrink-0 px-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {variant === 'mobile' ? (
          <Link
            to="/posts/new"
            onClick={onNavigate}
            className={buttonClasses('primary', 'min-h-11 w-full')}
          >
            Tạo bài viết
          </Link>
        ) : null}

        {NAV_ITEMS.map(({ label, to, icon: Icon }) => {
          const active = isItemActive(pathname, to);

          return (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              aria-label={isCollapsed ? label : undefined}
              title={isCollapsed ? label : undefined}
              className={cn(
                'flex min-h-11 items-center rounded-lg text-sm font-medium transition',
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3 py-2',
                active
                  ? 'bg-accent/10 text-accent-text'
                  : 'text-muted hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {isCollapsed ? null : label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-3">
        {!isCollapsed && workspace ? (
          <Link
            to="/billing"
            aria-label="Mở trang Gói & Credit"
            className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <CreditUsageCard
              remainingCredit={workspace.remainingCredit}
              className="transition hover:border-accent"
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
