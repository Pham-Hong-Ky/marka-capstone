import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap';
import { cn } from '@/utils/cn';

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDialogFocusTrap(open, dialogRef, onClose);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-xl border border-border bg-surface p-5 shadow-xl outline-none',
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-3">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
