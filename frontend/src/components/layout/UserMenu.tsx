import { useRef, useState } from 'react';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { WORKSPACE_ROLE_LABELS } from '@/services/workspace';
import type { WorkspaceRole } from '@/services/auth';
import { useLogout } from '@/hooks/useAuth';
import { useDismissable } from '@/hooks/useDismissable';
import { cn } from '@/utils/cn';

export const UserMenu = ({
  name,
  avatar,
  role,
  collapsed = false,
  menuPlacement = 'top',
  className,
}: {
  name: string;
  avatar?: string | null;
  role?: WorkspaceRole;
  collapsed?: boolean;
  menuPlacement?: 'top' | 'bottom';
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();

  useDismissable(containerRef, () => setOpen(false), { enabled: open });

  const menuPosition = collapsed
    ? 'bottom-0 left-full ml-2 w-56'
    : cn('left-2 right-2', menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1');

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Tài khoản"
        title={collapsed ? name : undefined}
        className={cn(
          'flex min-h-11 w-full items-center rounded-lg py-1.5 text-left transition hover:bg-surface-2',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2'
        )}
      >
        <Avatar name={name} src={avatar} className="h-9 w-9 bg-accent text-white" />

        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              {role ? (
                <span className="block truncate text-xs text-muted">
                  {WORKSPACE_ROLE_LABELS[role]}
                </span>
              ) : null}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" />
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Tài khoản"
          className={cn(
            'absolute z-30 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl',
            menuPosition
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
          >
            <LogOut className="h-4 w-4 text-muted" />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default UserMenu;
