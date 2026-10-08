import { type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { validateImageFile } from '@/utils/image';
import { cn } from '@/utils/cn';

export const ImageUploadField = ({
  id,
  label,
  hint = 'JPG, PNG hoặc WEBP, tối đa 2MB.',
  accept = 'image/png,image/jpeg,image/webp',
  disabled = false,
  onSelect,
  className,
}: {
  id: string;
  label?: string;
  hint?: string;
  accept?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  className?: string;
}) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    onSelect(file);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label
          htmlFor={id}
          className={cn('block text-sm font-medium text-foreground', disabled && 'opacity-60')}
        >
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-border disabled:opacity-60"
      />
      <p className="text-xs text-subtle">{hint}</p>
    </div>
  );
};

export default ImageUploadField;
