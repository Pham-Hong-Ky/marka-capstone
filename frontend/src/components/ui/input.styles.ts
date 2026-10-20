import { cn } from '@/utils/cn';

export const inputClasses = (error?: string, className?: string): string =>
  cn(
    'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-subtle',
    error
      ? 'border-danger focus:ring-2 focus:ring-danger/20'
      : 'border-border focus:border-accent focus:ring-2 focus:ring-accent/20',
    className
  );
