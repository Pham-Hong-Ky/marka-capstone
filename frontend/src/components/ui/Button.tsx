import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { buttonClasses, type ButtonVariant } from './button.styles';

export const Button = forwardRef<
  HTMLButtonElement,
  { variant?: ButtonVariant; isLoading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>
>(
  ({ variant = 'primary', isLoading = false, className, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={buttonClasses(variant, className)}
      {...props}
    >
      {isLoading ? 'Đang xử lý...' : children}
    </button>
  )
);

Button.displayName = 'Button';

export default Button;
