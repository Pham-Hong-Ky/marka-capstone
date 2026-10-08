import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type ButtonVariant = 'primary' | 'ghost' | 'outline';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  ghost: 'bg-transparent hover:bg-surface-2 text-foreground',
  outline: 'bg-transparent border border-border hover:bg-surface-2 text-foreground',
};

export const Button = forwardRef<
  HTMLButtonElement,
  { variant?: ButtonVariant; isLoading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>
>(
  ({ variant = 'primary', isLoading = false, className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {isLoading ? 'Đang xử lý...' : children}
    </button>
  )
);

Button.displayName = 'Button';

export default Button;
