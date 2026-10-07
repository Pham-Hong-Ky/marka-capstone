import type { Theme } from '@/stores/theme.store';

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'light' || theme === 'dark') return theme;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
};
