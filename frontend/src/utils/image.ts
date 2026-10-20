const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MAX_SIZE = 2 * 1024 * 1024;

interface ValidateImageOptions {
  allowedTypes?: string[];
  maxSize?: number;
}

export const validateImageFile = (
  file: File,
  { allowedTypes = DEFAULT_ALLOWED_TYPES, maxSize = DEFAULT_MAX_SIZE }: ValidateImageOptions = {}
): string | null => {
  if (!allowedTypes.includes(file.type)) {
    const labels = allowedTypes.map((type) => type.replace('image/', '').toUpperCase()).join(', ');
    return `Chỉ chấp nhận ảnh: ${labels}`;
  }
  if (file.size > maxSize) {
    return `Ảnh vượt quá ${Math.round(maxSize / (1024 * 1024))}MB`;
  }
  return null;
};
