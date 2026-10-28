import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import MembersTable from './MembersTable';
import InviteMemberModal from './InviteMemberModal';
import { useAuthStore } from '@/stores/auth.store';
import {
  useChangeMemberRole,
  useLeaveWorkspace,
  useRemoveMember,
  useWorkspaceMembers,
  useActiveWorkspace,
} from '@/hooks/useWorkspace';
import { getErrorMessage } from '@/utils/error';
import type { WorkspaceRole } from '@/services/auth';
import { SkeletonList } from '@/components/ui/Skeleton';

export const MembersTab = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspace = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id ?? null;
  const isOwner = activeWorkspace?.role === 'OWNER';

  const { data, isLoading, isError, error } = useWorkspaceMembers(workspaceId);
  const removeMember = useRemoveMember();
  const changeRole = useChangeMemberRole();
  const leaveWorkspace = useLeaveWorkspace();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(
    null
  );
  const [leaveOpen, setLeaveOpen] = useState(false);

  if (!workspaceId) {
    return <EmptyState title="Bạn chưa có workspace nào." />;
  }

  if (isLoading) {
    return <SkeletonList rows={4} />;
  }

  if (isError) {
    return <p className="text-sm text-danger">{getErrorMessage(error)}</p>;
  }

  const members = data?.members ?? [];
  const pendingInvites = data?.pendingInvites ?? [];

  const confirmRemove = () => {
    if (!memberToRemove) return;
    removeMember.mutate(
      { id: workspaceId, userId: memberToRemove.userId },
      { onSettled: () => setMemberToRemove(null) }
    );
  };

  const confirmLeave = () => {
    leaveWorkspace.mutate(workspaceId, { onSettled: () => setLeaveOpen(false) });
  };

  const changeMemberRole = (userId: string, role: WorkspaceRole) => {
    changeRole.mutate({ id: workspaceId, userId, role });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Thành viên</h2>
          <p className="mt-1 text-xs text-muted">
            {members.length} thành viên
            {pendingInvites.length > 0 ? `, ${pendingInvites.length} lời mời chờ` : ''}
          </p>
        </div>
        {isOwner ? (
          <Button type="button" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Mời thành viên
          </Button>
        ) : null}
      </div>

      <MembersTable
        members={members}
        pendingInvites={pendingInvites}
        isOwner={isOwner}
        currentUserId={user?.id ?? null}
        isRoleChanging={changeRole.isPending}
        onRoleChange={changeMemberRole}
        onRemove={setMemberToRemove}
      />

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setLeaveOpen(true)}
          isLoading={leaveWorkspace.isPending}
        >
          Rời workspace
        </Button>
      </div>

      <ConfirmDialog
        open={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        tone="danger"
        title="Xóa thành viên"
        confirmLabel="Xóa"
        isLoading={removeMember.isPending}
        onConfirm={confirmRemove}
        description={
          <>
            Xóa <span className="font-medium text-foreground">{memberToRemove?.name}</span> khỏi
            workspace? Thành viên này sẽ mất quyền truy cập ngay lập tức.
          </>
        }
      />

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        tone="danger"
        title="Rời workspace"
        confirmLabel="Rời workspace"
        isLoading={leaveWorkspace.isPending}
        onConfirm={confirmLeave}
        description="Bạn chắc chắn muốn rời workspace này? Bạn sẽ mất quyền truy cập cho đến khi được mời lại."
      />

      <InviteMemberModal
        open={inviteOpen}
        workspaceId={workspaceId}
        onClose={() => setInviteOpen(false)}
      />
    </div>
  );
};

export default MembersTab;
