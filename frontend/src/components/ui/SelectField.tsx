import { forwardRef, type SelectHTMLAttributes } from 'react';
import { inputClasses } from './input.styles';

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
        className={inputClasses(error, className)}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
});

SelectField.displayName = 'SelectField';

export default SelectField;
