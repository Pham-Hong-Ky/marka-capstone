import { Trash2 } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import SelectField from '@/components/ui/SelectField';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import {
  WORKSPACE_ROLE_LABELS,
  WORKSPACE_ROLE_OPTIONS,
  type WorkspaceMember,
  type WorkspacePendingInvite,
} from '@/services/workspace';
import type { WorkspaceRole } from '@/services/auth';
import { formatDate } from '@/utils/format';

interface MembersTableProps {
  members: WorkspaceMember[];
  pendingInvites: WorkspacePendingInvite[];
  isOwner: boolean;
  currentUserId: string | null;
  isRoleChanging: boolean;
  onRoleChange: (userId: string, role: WorkspaceRole) => void;
  onRemove: (member: { userId: string; name: string }) => void;
}

export const MembersTable = ({
  members,
  pendingInvites,
  isOwner,
  currentUserId,
  isRoleChanging,
  onRoleChange,
  onRemove,
}: MembersTableProps) => {
  if (members.length === 0 && pendingInvites.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Chưa có thành viên nào.
      </p>
    );
  }

  return (
    <section>
      <Table>
        <THead>
          <TR>
            <TH scope="col">Thành viên</TH>
            <TH scope="col">Vai trò</TH>
            <TH scope="col">Trạng thái</TH>
            <TH scope="col">Tham gia</TH>
            {isOwner ? (
              <TH scope="col" className="text-right">
                Hành động
              </TH>
            ) : null}
          </TR>
        </THead>
        <TBody>
          {members.map((member) => (
            <TR key={member.memberId}>
              <TD>
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
              </TD>
              <TD className="text-muted">
                {isOwner && member.userId !== currentUserId ? (
                  <SelectField
                    aria-label="Vai trò thành viên"
                    value={member.role}
                    disabled={isRoleChanging}
                    onChange={(event) => onRoleChange(member.userId, event.target.value as WorkspaceRole)}
                    className="w-auto px-2 py-1.5 disabled:opacity-60"
                  >
                    {WORKSPACE_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  WORKSPACE_ROLE_LABELS[member.role]
                )}
              </TD>
              <TD>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
                  Hoạt động
                </span>
              </TD>
              <TD className="text-muted">{formatDate(member.joinedAt)}</TD>
              {isOwner ? (
                <TD className="text-right">
                  {member.userId !== currentUserId ? (
                    <button
                      type="button"
                      aria-label={`Xóa ${member.name || member.email}`}
                      onClick={() =>
                        onRemove({
                          userId: member.userId,
                          name: member.name || member.email,
                        })
                      }
                      className="inline-grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </TD>
              ) : null}
            </TR>
          ))}

          {pendingInvites.map((invite) => (
            <TR key={invite.inviteId}>
              <TD>
                <p className="truncate font-medium text-foreground">{invite.email}</p>
                <p className="text-xs text-muted">Chưa có tài khoản</p>
              </TD>
              <TD className="text-muted">{WORKSPACE_ROLE_LABELS[invite.role]}</TD>
              <TD>
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                  Chờ chấp nhận
                </span>
              </TD>
              <TD className="text-muted">{formatDate(invite.invitedAt)}</TD>
              {isOwner ? <TD /> : null}
            </TR>
          ))}
        </TBody>
      </Table>
    </section>
  );
};

export default MembersTable;
