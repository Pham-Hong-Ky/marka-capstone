export const getSafeRedirect = (value: string | null): string => {
  if (!value) return '/';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
};

export const withRedirect = (path: string, redirect: string | null): string =>
  redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
