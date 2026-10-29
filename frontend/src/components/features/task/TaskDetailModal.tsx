import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { TaskItem, TaskStatus } from '@/services/task';
import { formatDateTime } from '@/utils/format';

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Cần làm',
  IN_PROGRESS: 'Đang làm',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
};

const getStatusLabel = (task: TaskItem) =>
  task.status === 'TODO' && !task.assignee ? 'Chưa giao' : STATUS_LABELS[task.status];

export const TaskDetailModal = ({
  open,
  onClose,
  task,
  canManage,
  onEdit,
  onDelete,
  onAssign,
  onLinkPost,
}: {
  open: boolean;
  onClose: () => void;
  task: TaskItem | null;
  canManage: boolean;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onAssign: (task: TaskItem) => void;
  onLinkPost: (task: TaskItem) => void;
}) => {
  if (!task) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task.title}
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="outline" onClick={() => onEdit(task)}>
                Sửa
              </Button>
              <Button
                type="button"
                className="bg-danger hover:bg-danger/90"
                onClick={() => onDelete(task)}
              >
                Xoá việc
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <dl className="grid gap-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Trạng thái</dt>
          <dd className="font-medium text-foreground">{getStatusLabel(task)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Ưu tiên</dt>
          <dd className="font-medium text-foreground">P{task.priority}/5</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Người nhận</dt>
          <dd className="font-medium text-foreground">{task.assignee?.name ?? 'Chưa giao'}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Hạn chót</dt>
          <dd className="font-medium text-foreground">
            {task.dueAt ? formatDateTime(task.dueAt) : 'Không có'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted">Bài viết</dt>
          <dd className="font-medium text-foreground">{task.post?.title ?? 'Chưa gắn'}</dd>
        </div>
      </dl>

      {task.description ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Mô tả</p>
          <p className="whitespace-pre-line text-sm text-muted">{task.description}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <Button type="button" variant="outline" onClick={() => onAssign(task)}>
            Giao việc
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={() => onLinkPost(task)}>
          {task.post ? 'Đổi bài viết' : 'Gắn bài viết'}
        </Button>
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
