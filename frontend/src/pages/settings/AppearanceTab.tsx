import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useThemeStore, type Theme } from '@/stores/theme.store';
import { cn } from '@/utils/cn';

interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: LucideIcon;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Sáng', description: 'Luôn dùng giao diện sáng.', icon: Sun },
  { value: 'dark', label: 'Tối', description: 'Luôn dùng giao diện tối.', icon: Moon },
  {
    value: 'system',
    label: 'Hệ thống',
    description: 'Theo cài đặt sáng/tối của thiết bị.',
    icon: Monitor,
  },
];

const ThemePreview = ({ theme }: { theme: Theme }) => {
  const screen = (dark: boolean) => (
    <div
      className={cn(
        'flex h-20 overflow-hidden rounded-md border border-border bg-background',
        dark ? 'dark' : 'theme-light'
      )}
    >
      <div className="w-6 bg-sidebar" />
      <div className="flex-1 space-y-1.5 p-1.5">
        <div className="h-1.5 w-1/2 rounded bg-surface-2" />
        <div className="h-4 rounded bg-surface" />
        <div className="h-1.5 w-2/3 rounded bg-surface-2" />
      </div>
    </div>
  );

  if (theme === 'system') {
    return (
      <div className="grid grid-cols-2 gap-1">
        {screen(false)}
        {screen(true)}
      </div>
    );
  }

  return screen(theme === 'dark');
};

export const AppearanceTab = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">Giao diện</h2>
      <p className="mt-1 text-[11px] text-muted">Chọn theme bạn muốn sử dụng.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const isActive = theme === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={isActive}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isActive
                  ? 'border-accent bg-accent/5'
                  : 'border-border bg-surface hover:border-accent/60'
              )}
            >
              <ThemePreview theme={value} />
              <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                <Icon className={cn('h-4 w-4', isActive ? 'text-accent-text' : 'text-muted')} />
                {label}
              </span>
              <span className="text-[11px] text-muted">{description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AppearanceTab;
