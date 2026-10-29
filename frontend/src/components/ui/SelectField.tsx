import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { inputClasses } from './input.styles';

export const SelectField = forwardRef<
  HTMLSelectElement,
  { label?: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>
>(
  (
    {
      label,
      error,
      id,
      className,
      children,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const selectId = id ?? props.name;
    const errorId = `${useId()}-error`;
    const describedBy =
      [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

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
          className={inputClasses(error, className)}
          {...props}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedBy}
        >
          {children}
        </select>
        {error ? (
          <p id={errorId} className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

SelectField.displayName = 'SelectField';

export default SelectField;
