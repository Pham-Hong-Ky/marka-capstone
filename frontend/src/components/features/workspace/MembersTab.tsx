import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import SelectField from '@/components/ui/SelectField';
import InviteMemberModal from './InviteMemberModal';
import { WORKSPACE_ROLE_LABELS } from '@/services/workspace';
import { useAuthStore } from '@/stores/auth.store';
import {
  useChangeMemberRole,
  useLeaveWorkspace,
  useRemoveMember,
  useWorkspaceMembers,
} from '@/hooks/useWorkspace';
import { getErrorMessage } from '@/utils/error';
import type { WorkspaceRole } from '@/services/auth';

const formatDate = (value: string): string => new Date(value).toLocaleDateString('vi-VN');

export const MembersTab = () => {
  const user = useAuthStore((state) => state.user);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const activeWorkspace =
    (user?.workspaces ?? []).find((workspace) => workspace.id === activeWorkspaceId) ??
    user?.workspaces[0];
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
    return <p className="text-sm text-muted">Đang tải danh sách thành viên...</p>;
  }

  if (isError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{getErrorMessage(error)}</p>;
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

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Thành viên</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Tham gia</th>
              {isOwner ? <th className="px-4 py-3 text-right font-medium">Hành động</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.memberId}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={member.name || member.email}
                      src={member.avatar}
                      className="h-9 w-9"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {member.name || member.email}
                      </p>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {isOwner && member.userId !== user?.id ? (
                    <SelectField
                      aria-label="Vai trò thành viên"
                      value={member.role}
                      disabled={changeRole.isPending}
                      onChange={(event) =>
                        changeRole.mutate({
                          id: workspaceId,
                          userId: member.userId,
                          role: event.target.value as WorkspaceRole,
                        })
                      }
                      className="w-auto px-2 py-1.5 disabled:opacity-60"
                    >
                      <option value="OWNER">{WORKSPACE_ROLE_LABELS.OWNER}</option>
                      <option value="CONTENT_CREATOR">
                        {WORKSPACE_ROLE_LABELS.CONTENT_CREATOR}
                      </option>
                    </SelectField>
                  ) : (
                    WORKSPACE_ROLE_LABELS[member.role]
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                    Hoạt động
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(member.joinedAt)}</td>
                {isOwner ? (
                  <td className="px-4 py-3 text-right">
                    {member.userId !== user?.id ? (
                      <button
                        type="button"
                        aria-label={`Xóa ${member.name || member.email}`}
                        onClick={() =>
                          setMemberToRemove({ userId: member.userId, name: member.name || member.email })
                        }
                        className="inline-grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}

            {pendingInvites.map((invite) => (
              <tr key={invite.inviteId}>
                <td className="px-4 py-3">
                  <p className="truncate font-medium text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted">Chưa có tài khoản</p>
                </td>
                <td className="px-4 py-3 text-muted">{WORKSPACE_ROLE_LABELS[invite.role]}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                    Chờ chấp nhận
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(invite.invitedAt)}</td>
                {isOwner ? <td className="px-4 py-3" /> : null}
              </tr>
            ))}
          </tbody>
        </table>

        {members.length === 0 && pendingInvites.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Chưa có thành viên nào.</p>
        ) : null}
      </section>

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
