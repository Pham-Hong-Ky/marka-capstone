import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'sidebar';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white',
  ghost: 'bg-transparent hover:bg-surface-2 text-foreground',
  outline: 'bg-transparent border border-border hover:bg-surface-2 text-foreground',
  sidebar: 'bg-transparent text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-active-foreground',
};

export const buttonClasses = (variant: ButtonVariant = 'primary', className?: string): string =>
  cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    className
  );
