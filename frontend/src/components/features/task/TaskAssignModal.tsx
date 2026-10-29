import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';
import { useAssignTask } from '@/hooks/useTasks';
import { useWorkspaceMembers } from '@/hooks/useWorkspace';
import type { TaskItem } from '@/services/task';

const UNASSIGN_VALUE = '__unassign__';

export const TaskAssignModal = ({
  open,
  onClose,
  workspaceId,
  task,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  task: TaskItem;
  onAssigned?: (task: TaskItem) => void;
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

  const isUnassign = assigneeId === UNASSIGN_VALUE;
  const nextAssigneeId = isUnassign ? null : assigneeId;

  const submit = () => {
    if (!assigneeId) return;
    assignTask.mutate(
      { workspaceId, taskId: task.id, assigneeId: nextAssigneeId },
      {
        onSuccess: (updated) => {
          close();
          onAssigned?.(updated);
        },
      }
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
            disabled={!assigneeId || (!isUnassign && assigneeId === task.assignee?.id)}
            isLoading={assignTask.isPending}
          >
            {isUnassign ? 'Bỏ giao' : 'Giao việc'}
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
        {task.assignee ? (
          <option value={UNASSIGN_VALUE}>Bỏ giao việc (xoá hạn chót)</option>
        ) : null}
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
