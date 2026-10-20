import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/stores/auth.store';
import { useActiveWorkspace } from '@/hooks/useWorkspace';

export const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspace = useActiveWorkspace();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={user} workspace={activeWorkspace} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header workspace={activeWorkspace} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
