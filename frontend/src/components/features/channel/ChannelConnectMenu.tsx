import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useDismissable } from '@/hooks/useDismissable';
import { useMenuKeyboard } from '@/hooks/useMenuKeyboard';
import { useStartChannelOauth } from '@/hooks/useChannels';
import {
  CONNECTABLE_PLATFORMS,
  getChannelPlatformMeta,
  type ChannelPlatform,
} from '@/services/channel';
import { cn } from '@/utils/cn';

export const ChannelConnectMenu = ({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const startOauth = useStartChannelOauth();

  useDismissable(containerRef, () => setOpen(false), { enabled: open });
  const onMenuKeyDown = useMenuKeyboard(menuRef, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (!canManage) return null;

  const platforms = CONNECTABLE_PLATFORMS.map((platform) => ({
    platform,
    meta: getChannelPlatformMeta(platform),
  })).filter(({ meta }) => meta.connect !== 'unavailable');

  const startConnect = (platform: ChannelPlatform) => {
    setOpen(false);

    if (getChannelPlatformMeta(platform).connect === 'oauth') {
      startOauth.mutate({ platform, workspaceId });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        className="min-h-11"
        aria-expanded={open}
        aria-haspopup="menu"
        isLoading={startOauth.isPending}
        onClick={() => setOpen((value) => !value)}
      >
        Kết nối kênh
        <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
      </Button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Kết nối kênh"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-xl"
        >
          {platforms.map(({ platform, meta }) => {
            const Icon = meta.icon;

            return (
              <button
                key={platform}
                type="button"
                role="menuitem"
                onClick={() => startConnect(platform)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{meta.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default ChannelConnectMenu;
