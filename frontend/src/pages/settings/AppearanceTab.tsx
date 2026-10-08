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

export const AppearanceTab = () => {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold text-foreground">Giao diện</h2>
      <p className="mt-1 text-xs text-muted">Chọn theme bạn muốn sử dụng.</p>

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
                'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition',
                isActive
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-border bg-surface-2 hover:border-indigo-400/60'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-muted')} />
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="text-xs text-muted">{description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default AppearanceTab;
