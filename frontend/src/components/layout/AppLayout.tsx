import { NavLink, Outlet } from 'react-router-dom';
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tổng quan', to: '/', icon: LayoutDashboard },
  { label: 'Nội dung', to: '/posts', icon: FileText },
  { label: 'Trợ lý AI', to: '/ai', icon: Sparkles },
  { label: 'Đăng bài', to: '/publishing', icon: Send },
  { label: 'Credit & Gói', to: '/billing', icon: CreditCard },
  { label: 'Cài đặt', to: '/settings', icon: Settings },
];

export const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const logout = useLogout();

  const workspaces = user?.workspaces ?? [];
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-indigo-600 to-purple-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Marka</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    : 'text-muted hover:bg-surface-2 hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar/80 px-5 backdrop-blur">
          <select
            value={activeWorkspace?.id ?? ''}
            onChange={(event) => setActiveWorkspace(event.target.value)}
            disabled={workspaces.length <= 1}
            className="max-w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-500 disabled:opacity-70"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-4">
            {activeWorkspace ? (
              <span className="hidden text-xs text-muted sm:inline">
                {activeWorkspace.plan} · {activeWorkspace.remainingCredit} credit
              </span>
            ) : null}

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <span className="hidden text-sm text-foreground md:inline">{user?.name}</span>
            </div>

            <button
              type="button"
              onClick={() => logout.mutate()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
