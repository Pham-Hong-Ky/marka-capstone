import SidebarContent from './SidebarContent';
import { useUiStore } from '@/stores/ui.store';
import type { AuthUser, UserWorkspace } from '@/services/auth';
import { cn } from '@/utils/cn';

export const Sidebar = ({
  user,
  workspace,
}: {
  user: AuthUser | null;
  workspace: UserWorkspace | undefined;
}) => {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:flex',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      <SidebarContent
        user={user}
        workspace={workspace}
        variant="desktop"
        collapsed={collapsed}
        onToggleCollapse={toggleSidebar}
      />
    </aside>
  );
};

export default Sidebar;
