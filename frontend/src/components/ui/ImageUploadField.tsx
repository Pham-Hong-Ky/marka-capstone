import { type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { buttonClasses } from '@/components/ui/button.styles';
import { validateImageFile } from '@/utils/image';
import { cn } from '@/utils/cn';

export const ImageUploadField = ({
  id,
  label,
  hint = 'JPG, PNG hoặc WEBP, tối đa 2MB.',
  accept = 'image/png,image/jpeg,image/webp',
  maxSize,
  disabled = false,
  onSelect,
  className,
}: {
  id: string;
  label?: string;
  hint?: string;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  onSelect: (file: File) => void;
  className?: string;
}) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    const error = validateImageFile(file, { maxSize });
    if (error) {
      toast.error(error);
      return;
    }

    onSelect(file);
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <span className={cn('block text-sm font-medium text-foreground', disabled && 'opacity-60')}>
          {label}
        </span>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className={cn(
            buttonClasses('outline', 'cursor-pointer'),
            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
            disabled && 'pointer-events-none opacity-50'
          )}
        >
          <Upload className="h-4 w-4" />
          Chọn ảnh
          <input
            id={id}
            type="file"
            accept={accept}
            disabled={disabled}
            onChange={handleChange}
            className="sr-only"
          />
        </label>
        <p className="text-[11px] text-subtle">{hint}</p>
      </div>
    </div>
  );
};

export default ImageUploadField;
