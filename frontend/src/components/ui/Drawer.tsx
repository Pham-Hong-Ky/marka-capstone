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
  tone = 'light',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  id?: string;
  children: ReactNode;
  side?: 'left' | 'right';
  tone?: 'light' | 'dark';
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const dark = tone === 'dark';

  useDialogFocusTrap(open, panelRef, onClose, { initialFocusRef: closeButtonRef });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 z-50 w-72 max-w-[85vw] overflow-y-auto p-4 shadow-xl outline-none',
          dark
            ? 'bg-sidebar text-sidebar-foreground'
            : 'bg-surface text-foreground',
          side === 'left'
            ? dark
              ? 'left-0 border-r border-sidebar-border'
              : 'left-0 border-r border-border'
            : dark
              ? 'right-0 border-l border-sidebar-border'
              : 'right-0 border-l border-border'
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2
            id={titleId}
            className={cn(
              'truncate text-sm font-semibold',
              dark ? 'text-sidebar-foreground' : 'text-foreground'
            )}
          >
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              dark
                ? 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
                : 'text-muted hover:bg-surface-2 hover:text-foreground'
            )}
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
