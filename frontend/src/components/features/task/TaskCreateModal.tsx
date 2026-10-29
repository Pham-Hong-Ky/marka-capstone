import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';
import TextArea from '@/components/ui/TextArea';
import TextField from '@/components/ui/TextField';
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import { useWorkspaceMembers } from '@/hooks/useWorkspace';
import type { TaskItem } from '@/services/task';
import { cn } from '@/utils/cn';

const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Nhập tiêu đề việc')
    .max(255, 'Tiêu đề tối đa 255 ký tự'),
  description: z.string().trim().max(2000, 'Mô tả tối đa 2000 ký tự'),
  assigneeId: z.string(),
  dueAt: z.string(),
  priority: z.number().int().min(1).max(5),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const PRIORITY_OPTIONS = [1, 2, 3, 4, 5];

const toLocalInput = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const buildDefaults = (task?: TaskItem | null): TaskFormValues => ({
  title: task?.title ?? '',
  description: task?.description ?? '',
  assigneeId: task?.assignee?.id ?? '',
  dueAt: toLocalInput(task?.dueAt ?? null),
  priority: task?.priority ?? 3,
});

export const TaskCreateModal = ({
  open,
  onClose,
  workspaceId,
  task = null,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  task?: TaskItem | null;
}) => {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { data: membersData } = useWorkspaceMembers(open ? workspaceId : null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: buildDefaults(task),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaults(task));
    }
  }, [open, task, reset]);

  const isPending = createTask.isPending || updateTask.isPending;

  const close = () => {
    if (isPending) return;
    onClose();
  };

  const onSubmit = handleSubmit((values) => {
    const payload = {
      title: values.title,
      description: values.description,
      priority: values.priority,
    };
    const dueAt = values.dueAt ? new Date(values.dueAt).toISOString() : null;

    if (task) {
      updateTask.mutate(
        { workspaceId, taskId: task.id, payload: { ...payload, dueAt } },
        { onSuccess: close }
      );
      return;
    }

    createTask.mutate(
      {
        workspaceId,
        payload: {
          ...payload,
          assigneeId: values.assigneeId || undefined,
          dueAt: dueAt ?? undefined,
        },
      },
      { onSuccess: close }
    );
  });

  return (
    <Modal
      open={open}
      onClose={close}
      title={task ? 'Sửa công việc' : 'Tạo công việc'}
      className="max-w-lg"
    >
      <form id="task-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label="Tiêu đề"
          placeholder="Ví dụ: Viết brief chiến dịch ra mắt"
          error={errors.title?.message}
          {...register('title')}
        />

        <TextArea
          label="Mô tả"
          rows={4}
          placeholder="Mô tả ngắn về công việc, đầu ra cần có..."
          error={errors.description?.message}
          {...register('description')}
        />

        <div className={cn('grid gap-4', !task && 'sm:grid-cols-2')}>
          {!task ? (
            <SelectField
              label="Người nhận"
              error={errors.assigneeId?.message}
              {...register('assigneeId')}
            >
              <option value="">Chưa giao</option>
              {(membersData?.members ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          <SelectField
            label="Ưu tiên"
            error={errors.priority?.message}
            {...register('priority', { valueAsNumber: true })}
          >
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                P{value}
              </option>
            ))}
          </SelectField>
        </div>

        <TextField
          label="Hạn chót"
          type="datetime-local"
          error={errors.dueAt?.message}
          {...register('dueAt')}
        />
      </form>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={close} disabled={isPending}>
          Huỷ
        </Button>
        <Button type="submit" form="task-form" isLoading={isPending}>
          {task ? 'Lưu thay đổi' : 'Tạo việc'}
        </Button>
      </div>
    </Modal>
  );
};

export default TaskCreateModal;
