import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Moon, Plus, Sun } from 'lucide-react';
import Button from '@/components/ui/Button';
import UserMenu from './UserMenu';
import { resolveBreadcrumbs } from '@/config/navigation';
import { useThemeStore } from '@/stores/theme.store';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useAuthStore } from '@/stores/auth.store';
import type { UserWorkspace } from '@/services/auth';

export const Header = ({ workspace }: { workspace: UserWorkspace | undefined }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const resolvedTheme = useResolvedTheme();
  const setTheme = useThemeStore((state) => state.setTheme);

  const crumbs = resolveBreadcrumbs(pathname);
  const isDark = resolvedTheme === 'dark';
  const themeActionLabel = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-sidebar/80 px-5 backdrop-blur">
      <nav aria-label="Đường dẫn" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight
                  className="hidden h-4 w-4 shrink-0 text-subtle sm:block"
                  aria-hidden="true"
                />
              ) : null}

              {!isLast && crumb.to ? (
                <Link
                  to={crumb.to}
                  className="hidden truncate text-muted transition hover:text-foreground sm:block"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-semibold text-foreground">
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      <Button
        type="button"
        variant="ghost"
        aria-label={themeActionLabel}
        title={themeActionLabel}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="h-11 w-11 shrink-0 px-0"
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      {workspace ? (
        <Button
          type="button"
          onClick={() => navigate('/posts/new')}
          className="hidden shrink-0 sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Tạo bài viết
        </Button>
      ) : null}

      <UserMenu
        name={user?.name ?? ''}
        avatar={user?.avatar}
        role={workspace?.role}
        menuPlacement="bottom"
        className="w-52 shrink-0 lg:hidden"
      />
    </header>
  );
};

export default Header;
