import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Mail, MoreHorizontal, Unlock } from 'lucide-react';
import { useMenuKeyboard } from '@/hooks/useMenuKeyboard';
import type { AdminUser } from '@/services/admin';
import { cn } from '@/utils/cn';

const MENU_ITEM_SELECTOR = '[role="menuitem"]';
const MENU_WIDTH = 224;
const MENU_ITEM_HEIGHT = 44;
const MENU_PADDING = 8;

const menuItemClasses =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none';

export const AdminUserRowActions = ({
  user,
  isSelf,
  onSendInvite,
  onToggleSuspension,
}: {
  user: AdminUser;
  isSelf: boolean;
  onSendInvite: () => void;
  onToggleSuspension: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const placeMenu = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = (isSelf ? 1 : 2) * MENU_ITEM_HEIGHT + MENU_PADDING;
      const opensUpward = rect.bottom + estimatedHeight + 6 > window.innerHeight;
      const top = opensUpward ? rect.top - estimatedHeight - 6 : rect.bottom + 6;
      const maxLeft = Math.max(8, window.innerWidth - MENU_WIDTH - 8);

      setPosition({ top, left: Math.min(Math.max(8, rect.right - MENU_WIDTH), maxLeft) });
    };

    placeMenu();

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnViewportChange = () => setOpen(false);

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);

    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus();
    });

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
      cancelAnimationFrame(frame);
    };
  }, [open, isSelf]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const onMenuKeyDown = useMenuKeyboard(menuRef, () => setOpen(false));
  const menuLabel = `Thao tác với người dùng ${user.name}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={menuLabel}
              onKeyDown={onMenuKeyDown}
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 w-56 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                className={cn(menuItemClasses, 'text-foreground')}
                onClick={() => runAction(onSendInvite)}
              >
                <Mail className="h-4 w-4 text-muted" />
                Gửi email mời tester
              </button>

              {isSelf ? null : (
                <button
                  type="button"
                  role="menuitem"
                  className={cn(menuItemClasses, user.isSuspended ? 'text-foreground' : 'text-danger')}
                  onClick={() => runAction(onToggleSuspension)}
                >
                  {user.isSuspended ? (
                    <Unlock className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  {user.isSuspended ? 'Mở khoá' : 'Khoá'}
                </button>
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default AdminUserRowActions;
