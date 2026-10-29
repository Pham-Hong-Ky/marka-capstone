import { useEffect, useRef, type RefObject } from 'react';

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
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismissRef.current();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current();
    };

    document.addEventListener('mousedown', onPointerDown);
    if (closeOnEscape) document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      if (closeOnEscape) document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, enabled, closeOnEscape]);
};
