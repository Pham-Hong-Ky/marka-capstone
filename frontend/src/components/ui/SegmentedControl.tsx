import { cn } from '@/utils/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className={cn('inline-flex rounded-lg border border-border bg-surface-2 p-0.5', className)}
  >
    {options.map((option) => {
      const active = option.value === value;

      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          className={cn(
            'min-h-11 rounded-md px-3 text-xs font-medium transition',
            active ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
