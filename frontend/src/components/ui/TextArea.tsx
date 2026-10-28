import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { inputClasses } from './input.styles';

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  { label: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>
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
    const areaId = id ?? props.name;
    const errorId = `${useId()}-error`;
    const describedBy =
      [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        <label htmlFor={areaId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        <textarea
          ref={ref}
          id={areaId}
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

TextArea.displayName = 'TextArea';

export default TextArea;
