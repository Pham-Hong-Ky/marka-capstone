import { useCallback, type KeyboardEvent, type RefObject } from 'react';

const MENU_ITEM_SELECTOR = '[role="menuitemradio"], [role="menuitem"]';

export const useMenuKeyboard = (
  menuRef: RefObject<HTMLElement | null>,
  onClose: () => void
) =>
  useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!menuRef.current) return;

      const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR));
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const moveTo = (index: number) => {
        event.preventDefault();
        items[(index + items.length) % items.length].focus();
      };

      switch (event.key) {
        case 'ArrowDown':
          moveTo(currentIndex + 1);
          break;
        case 'ArrowUp':
          moveTo(currentIndex - 1);
          break;
        case 'Home':
          moveTo(0);
          break;
        case 'End':
          moveTo(items.length - 1);
          break;
        case 'Tab':
          onClose();
          break;
        default:
          break;
      }
    },
    [menuRef, onClose]
  );

export default useMenuKeyboard;
