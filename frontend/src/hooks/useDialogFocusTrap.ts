import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal lồng nhau: chỉ dialog trên cùng xử lý Escape và khoá scroll.
const dialogStack: symbol[] = [];
let bodyLockCount = 0;
let bodyOverflowBeforeLock = '';

interface DialogFocusTrapOptions {
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export const useDialogFocusTrap = (
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  { initialFocusRef }: DialogFocusTrapOptions = {}
): void => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const token = Symbol('dialog');
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogStack.push(token);
    if (bodyLockCount === 0) bodyOverflowBeforeLock = document.body.style.overflow;
    bodyLockCount += 1;
    document.body.style.overflow = 'hidden';
    (initialFocusRef?.current ?? containerRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;

      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !containerRef.current) return;

      const focusable = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = dialogStack.lastIndexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [containerRef, initialFocusRef, open]);
};

export default useDialogFocusTrap;
