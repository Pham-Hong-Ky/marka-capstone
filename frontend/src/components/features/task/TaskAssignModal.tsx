import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';
import { useAssignTask } from '@/hooks/useTasks';
import { useWorkspaceMembers } from '@/hooks/useWorkspace';
import type { TaskItem } from '@/services/task';

export const TaskAssignModal = ({
  open,
  onClose,
  workspaceId,
  task,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  task: TaskItem;
}) => {
  const [assigneeId, setAssigneeId] = useState('');
  const assignTask = useAssignTask();
  const { data: membersData } = useWorkspaceMembers(open ? workspaceId : null);

  useEffect(() => {
    if (open) {
      setAssigneeId(task.assignee?.id ?? '');
    }
  }, [open, task]);

  const close = () => {
    if (assignTask.isPending) return;
    onClose();
  };

  const submit = () => {
    if (!assigneeId) return;
    assignTask.mutate(
      { workspaceId, taskId: task.id, assigneeId },
      { onSuccess: close }
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Giao việc"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={assignTask.isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!assigneeId || assigneeId === task.assignee?.id}
            isLoading={assignTask.isPending}
          >
            Giao việc
          </Button>
        </>
      }
    >
      <SelectField
        label="Người nhận"
        value={assigneeId}
        onChange={(event) => setAssigneeId(event.target.value)}
      >
        <option value="">Chọn thành viên</option>
        {(membersData?.members ?? []).map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </SelectField>
    </Modal>
  );
};

export default TaskAssignModal;
