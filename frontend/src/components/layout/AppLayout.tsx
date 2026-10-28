import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import SidebarContent from './SidebarContent';
import Drawer from '@/components/ui/Drawer';
import { MOBILE_NAV_ID } from '@/config/navigation';
import { useCurrentUser } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import { useActiveWorkspace } from '@/hooks/useWorkspace';
import { useUiStore } from '@/stores/ui.store';

export const AppLayout = () => {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const currentUser = useCurrentUser();
  const activeWorkspace = useActiveWorkspace();
  const { pathname } = useLocation();
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const closeMobileNav = useUiStore((state) => state.closeMobileNav);

  useEffect(() => {
    if (currentUser.data) updateUser(currentUser.data);
  }, [currentUser.data, updateUser]);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const onBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMobileNav();
    };

    desktopQuery.addEventListener('change', onBreakpointChange);

    return () => desktopQuery.removeEventListener('change', onBreakpointChange);
  }, [closeMobileNav]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={user} workspace={activeWorkspace} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header workspace={activeWorkspace} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>

      <Drawer
        id={MOBILE_NAV_ID}
        open={mobileNavOpen}
        onClose={closeMobileNav}
        title="Điều hướng"
      >
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
