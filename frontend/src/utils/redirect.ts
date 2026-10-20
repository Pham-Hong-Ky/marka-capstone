export const getSafeRedirect = (value: string | null): string => {
  if (!value) return '/';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
};
