import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'ghost' | 'outline';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white',
  ghost: 'bg-transparent hover:bg-surface-2 text-foreground',
  outline: 'bg-transparent border border-border hover:bg-surface-2 text-foreground',
};

export const buttonClasses = (variant: ButtonVariant = 'primary', className?: string): string =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    className
  );
