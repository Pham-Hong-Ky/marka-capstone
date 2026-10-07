import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme.store';
import { DARK_QUERY, resolveTheme } from '@/utils/theme';

export const useResolvedTheme = (): 'light' | 'dark' => {
  const theme = useThemeStore((state) => state.theme);
  const [resolved, setResolved] = useState(() => resolveTheme(theme));

  useEffect(() => {
    setResolved(resolveTheme(theme));
    if (theme !== 'system') return;

    const media = window.matchMedia(DARK_QUERY);
    const handleChange = () => setResolved(resolveTheme('system'));
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  return resolved;
};
