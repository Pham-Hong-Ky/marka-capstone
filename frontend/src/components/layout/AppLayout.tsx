import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/stores/auth.store';

export const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);

  const workspaces = user?.workspaces ?? [];
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={user} workspace={activeWorkspace} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header workspace={activeWorkspace} />

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
