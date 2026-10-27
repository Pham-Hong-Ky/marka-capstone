import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import SidebarContent from './SidebarContent';
import Drawer from '@/components/ui/Drawer';
import { useAuthStore } from '@/stores/auth.store';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { useUiStore } from '@/stores/ui.store';

export const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspace = useActiveWorkspace();
  const { pathname } = useLocation();
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const closeMobileNav = useUiStore((state) => state.closeMobileNav);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={user} workspace={activeWorkspace} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header workspace={activeWorkspace} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>

      <Drawer id="mobile-nav" open={mobileNavOpen} onClose={closeMobileNav} title="Điều hướng">
        <SidebarContent
          user={user}
          workspace={activeWorkspace}
          variant="mobile"
          onNavigate={closeMobileNav}
        />
      </Drawer>
    </div>
  );
};

export default AppLayout;
