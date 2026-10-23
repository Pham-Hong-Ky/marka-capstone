export const formatNumber = (value: number): string => value.toLocaleString('vi-VN');

export const formatDate = (value: string): string => new Date(value).toLocaleDateString('vi-VN');

export const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
