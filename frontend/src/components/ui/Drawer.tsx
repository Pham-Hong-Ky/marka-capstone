import { useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocusTrap } from '@/hooks/useDialogFocusTrap';
import { cn } from '@/utils/cn';

export const Drawer = ({
  open,
  onClose,
  title,
  id,
  children,
  side = 'left',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  id?: string;
  children: ReactNode;
  side?: 'left' | 'right';
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useDialogFocusTrap(open, panelRef, onClose, { initialFocusRef: closeButtonRef });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 z-50 w-72 max-w-[85vw] overflow-y-auto bg-sidebar p-4 shadow-xl outline-none',
          side === 'left' ? 'left-0 border-r border-border' : 'right-0 border-l border-border'
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {children}
      </div>
    </>
  );
};

export default Drawer;
