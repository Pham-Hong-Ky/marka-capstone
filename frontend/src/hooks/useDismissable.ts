import { useEffect, type RefObject } from 'react';

type DismissableOptions = {
  enabled?: boolean;
  closeOnEscape?: boolean;
};

export const useDismissable = (
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  options: DismissableOptions = {}
): void => {
  const { enabled = true, closeOnEscape = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('mousedown', onPointerDown);
    if (closeOnEscape) document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      if (closeOnEscape) document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, onDismiss, enabled, closeOnEscape]);
};
