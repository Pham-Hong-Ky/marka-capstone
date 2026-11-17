const DEFAULT_FILE_NAME = 'anh-marka';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const getBaseName = (url: string): string => {
  const lastSegment = url.split('?')[0].split('/').pop() ?? '';
  const name = lastSegment.replace(/\.[^.]+$/, '');
  return name && !url.startsWith('blob:') ? name : DEFAULT_FILE_NAME;
};

// Tải qua blob vì thuộc tính `download` của thẻ <a> bị bỏ qua với ảnh khác origin (Cloudinary).
export const downloadImage = async (url: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Không tải được ảnh (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const extension = EXTENSION_BY_MIME[blob.type] ?? 'jpg';
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${getBaseName(url)}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export default downloadImage;
