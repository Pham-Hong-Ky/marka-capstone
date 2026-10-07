import { useEffect, type ReactNode } from 'react';
import { useThemeStore, type Theme } from '@/stores/theme.store';
import { DARK_QUERY, resolveTheme } from '@/utils/theme';

const applyTheme = (theme: Theme) => {
  const isDark = resolveTheme(theme) === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;

    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => applyTheme('system');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
};

export default ThemeProvider;
