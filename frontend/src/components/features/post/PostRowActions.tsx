import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { PostSummary } from '@/services/post';
import { cn } from '@/utils/cn';

const MENU_ITEM_SELECTOR = '[role="menuitem"]';
const MENU_WIDTH = 192;
const MENU_ITEM_HEIGHT = 44;
const MENU_PADDING = 8;

const menuItemClasses =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none';

export const PostRowActions = ({
  post,
  canEdit,
  onView,
  onEdit,
  onDelete,
}: {
  post: PostSummary;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
      const estimatedHeight = (canEdit ? 3 : 1) * MENU_ITEM_HEIGHT + MENU_PADDING;
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
  }, [open, canEdit]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Thao tác với bài viết ${post.title}`}
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
              aria-label={`Thao tác với bài viết ${post.title}`}
              onKeyDown={onMenuKeyDown}
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 w-48 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                className={cn(menuItemClasses, 'text-foreground')}
                onClick={() => runAction(onView)}
              >
                <Eye className="h-4 w-4 text-muted" />
                Xem chi tiết
              </button>

              {canEdit ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(menuItemClasses, 'text-foreground')}
                    onClick={() => runAction(onEdit)}
                  >
                    <Pencil className="h-4 w-4 text-muted" />
                    Chỉnh sửa
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(menuItemClasses, 'text-danger')}
                    onClick={() => runAction(onDelete)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Xoá
                  </button>
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default PostRowActions;
