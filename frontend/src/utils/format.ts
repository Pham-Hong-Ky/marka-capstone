export const formatNumber = (value: number): string => value.toLocaleString('vi-VN');

export const formatDate = (value: string): string => new Date(value).toLocaleDateString('vi-VN');
