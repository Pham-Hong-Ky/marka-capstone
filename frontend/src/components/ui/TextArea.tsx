import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { inputClasses } from './input.styles';

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  { label: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ label, error, id, className, ...props }, ref) => {
  const areaId = id ?? props.name;

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
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
