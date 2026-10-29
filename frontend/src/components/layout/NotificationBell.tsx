import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications';
import type { AppNotification } from '@/services/notification';
import { useDismissable } from '@/hooks/useDismissable';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { getErrorMessage } from '@/utils/error';

const describeNotification = (notification: AppNotification) => {
  switch (notification.type) {
    case 'POST_SUBMITTED':
      return { title: 'Bài viết chờ duyệt', description: notification.payload.postTitle };
    case 'POST_APPROVED':
      return { title: 'Bài viết đã được duyệt', description: notification.payload.postTitle };
    case 'POST_REJECTED':
      return {
        title: 'Bài viết bị từ chối',
        description: notification.payload.reason ?? notification.payload.postTitle,
      };
    case 'MEMBER_JOINED':
      return { title: 'Thành viên mới tham gia workspace' };
    case 'TASK_ASSIGNED':
      return { title: 'Bạn được giao việc', description: notification.payload.taskTitle };
    case 'TASK_STATUS_CHANGED':
      return {
        title: 'Công việc đổi trạng thái',
        description: notification.payload.taskTitle,
      };
    case 'TASK_DUE_SOON':
      return { title: 'Công việc sắp đến hạn', description: notification.payload.taskTitle };
    case 'TASK_OVERDUE':
      return { title: 'Công việc đã quá hạn', description: notification.payload.taskTitle };
    default:
      return { title: 'Thông báo mới' };
  }
};

export const NotificationBell = ({ workspaceId }: { workspaceId?: string }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useNotifications(workspaceId ?? null);
  const unreadCount = useUnreadNotificationCount(workspaceId ?? null);
  const markRead = useMarkNotificationRead(workspaceId ?? null);
  const markAllRead = useMarkAllNotificationsRead(workspaceId ?? null);

  const unread = unreadCount.data ?? 0;
  const items = notifications.data?.notifications ?? [];

  useDismissable(containerRef, () => setOpen(false), { enabled: open });

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleOpenNotification = (notification: AppNotification) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }

    setOpen(false);

    const taskId = notification.payload.taskId;
    if (taskId) {
      navigate(`/tasks?taskId=${taskId}`);
      return;
    }

    const postId = notification.payload.postId;
    if (postId) {
      navigate(`/posts?postId=${postId}`);
    }
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Thông báo"
        onClick={() => setOpen((value) => !value)}
        className="relative h-11 w-11 px-0"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Thông báo"
          tabIndex={-1}
          className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl outline-none"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Thông báo</p>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={unread === 0 || markAllRead.isPending}
              className="text-xs font-medium text-accent-text transition hover:underline disabled:cursor-not-allowed disabled:text-subtle disabled:no-underline"
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>

          {notifications.isLoading ? (
            <div className="space-y-3 px-4 py-4" role="status" aria-label="Đang tải thông báo">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ) : null}

          {notifications.isError ? (
            <div className="px-4 py-4">
              <p className="text-sm text-danger">{getErrorMessage(notifications.error)}</p>
              <button
                type="button"
                onClick={() => notifications.refetch()}
                className="mt-2 text-xs font-medium text-accent-text hover:underline"
              >
                Thử lại
              </button>
            </div>
          ) : null}

          {!notifications.isLoading && !notifications.isError && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Chưa có thông báo nào.</p>
          ) : null}

          {items.length > 0 ? (
            <div className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.map((notification) => {
                const { title, description } = describeNotification(notification);

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpenNotification(notification)}
                    className={cn(
                      'block w-full px-4 py-3 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                      !notification.isRead && 'bg-accent/5'
                    )}
                  >
                    <span className="flex items-start gap-2">
                      {!notification.isRead ? (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                          aria-label="Chưa đọc"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{title}</span>
                        {description ? (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted">
                            {description}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-xs text-subtle">
                          {formatDateTime(notification.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
