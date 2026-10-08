import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Plus, Settings } from 'lucide-react';
import BrandLogo from '@/components/shared/BrandLogo';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/utils/cn';

const MENU_ITEM_SELECTOR = '[role="menuitemradio"], [role="menuitem"]';

export const WorkspaceSwitcher = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useAuthStore((state) => state.setActiveWorkspace);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const workspaces = user?.workspaces ?? [];
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR)?.focus();

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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

  const selectWorkspace = (id: string) => {
    setActiveWorkspace(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Chuyển workspace"
        className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-left transition hover:border-indigo-400/60"
      >
        {activeWorkspace?.logo ? (
          <img
            src={activeWorkspace.logo}
            alt=""
            className="h-7 w-7 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <BrandLogo className="h-7 w-7 rounded-lg" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {activeWorkspace?.name ?? 'Chọn workspace'}
          </span>
          {activeWorkspace ? (
            <span className="block truncate text-[11px] text-muted">
              {activeWorkspace.plan} · {activeWorkspace.remainingCredit} credit
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Chuyển workspace"
          onKeyDown={onMenuKeyDown}
          className="absolute left-3 right-3 z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        >
          <div className="max-h-64 overflow-y-auto p-1">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                role="menuitemradio"
                aria-checked={workspace.id === activeWorkspace?.id}
                onClick={() => selectWorkspace(workspace.id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
              >
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.id === activeWorkspace?.id ? (
                  <Check className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                ) : null}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <Plus className="h-4 w-4 text-muted" />
              Tạo workspace mới
            </button>
            <Link
              to="/settings/workspace"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <Settings className="h-4 w-4 text-muted" />
              Cài đặt workspace
            </Link>
          </div>
        </div>
      ) : null}

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default WorkspaceSwitcher;
