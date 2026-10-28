import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { inputClasses } from './input.styles';

export const TextField = forwardRef<
  HTMLInputElement,
  { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>
>(
  (
    {
      label,
      error,
      id,
      className,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? props.name;
    const errorId = `${useId()}-error`;
    const describedBy =
      [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={inputClasses(error, className)}
          {...props}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy}
        />
        {error ? (
          <p id={errorId} className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

TextField.displayName = 'TextField';

export default TextField;
