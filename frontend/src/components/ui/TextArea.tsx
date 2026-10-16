import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  { label: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ label, error, id, className, ...props }, ref) => {
  const areaId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      <label htmlFor={areaId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        ref={ref}
        id={areaId}
        className={cn(
          'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-subtle',
          error ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-indigo-500',
          className
        )}
        {...props}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
