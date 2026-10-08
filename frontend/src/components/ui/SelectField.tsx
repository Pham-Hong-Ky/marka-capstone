import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const SelectField = forwardRef<
  HTMLSelectElement,
  { label?: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>
>(({ label, error, id, className, children, ...props }, ref) => {
  const selectId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition',
          error ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-indigo-500',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
});

SelectField.displayName = 'SelectField';

export default SelectField;
