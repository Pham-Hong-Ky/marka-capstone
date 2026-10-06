import { randomUUID } from 'crypto';
import type { Prisma, WorkspaceRole } from '@prisma/client';
import workspaceRepository from './workspace.repository.js';
import auditService from '../audit/audit.service.js';
import env from '../../config/env.js';
import { sendEmail } from '../../utils/mailer.js';
import { uploadImageBuffer } from '../../utils/cloudinary.js';
import { buildWorkspaceInviteEmail } from '../../templates/workspaceInviteEmail.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors/index.js';

const INVITE_TTL_DAYS = 7;

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Chủ sở hữu',
  CONTENT_CREATOR: 'Người sáng tạo nội dung',
};

interface WorkspaceSummary {
  id: string;
  name: string;
  logo: string | null;
  plan: string;
  role: WorkspaceRole;
  remainingCredit: number;
  monthlyQuota: number;
}

const assertWorkspaceExists = async (workspaceId: string) => {
  const workspace = await workspaceRepository.findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }
  return workspace;
};

const notifyOwners = async (workspaceId: string, actorId: string, payload: Record<string, unknown>) => {
  const ownerIds = await workspaceRepository.findOwnerIds(workspaceId);
  await Promise.all(
    ownerIds
      .filter((ownerId) => ownerId !== actorId)
      .map((ownerId) =>
        workspaceRepository.createNotification({
          userId: ownerId,
          workspaceId,
          type: 'MEMBER_JOINED',
          payload,
        })
      )
  );
};

export const createWorkspace = async (
  userId: string,
  data: { name: string; logo?: string | null }
) => {
  const existing = await workspaceRepository.findWorkspaceByNameAndOwner(userId, data.name);
  if (existing) {
    throw new ConflictError('Bạn đã có workspace trùng tên này');
  }

  const workspace = await workspaceRepository.createWorkspaceWithOwner(data, userId);

  await auditService.recordAuditLog({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'WORKSPACE_CREATE',
    targetType: 'Workspace',
    targetId: workspace.id,
    metadata: { name: workspace.name },
  });

  return {
    id: workspace.id,
    name: workspace.name,
    logo: workspace.logo,
    plan: workspace.plan,
    role: 'OWNER' as WorkspaceRole,
    remainingCredit: workspace.remainingCredit,
    monthlyQuota: workspace.monthlyQuota,
  };
};

export const listMyWorkspaces = async (userId: string): Promise<WorkspaceSummary[]> => {
  const memberships = await workspaceRepository.findWorkspacesByUserId(userId);

  return memberships.map((member) => ({
    id: member.workspace.id,
    name: member.workspace.name,
    logo: member.workspace.logo,
    plan: member.workspace.plan,
    role: member.role,
    remainingCredit: member.workspace.remainingCredit,
    monthlyQuota: member.workspace.monthlyQuota,
  }));
};

export const updateWorkspace = async (
  workspaceId: string,
  userId: string,
  data: { name?: string; logo?: string | null }
) => {
  await assertWorkspaceExists(workspaceId);

  const workspace = await workspaceRepository.updateWorkspace(workspaceId, data);

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'WORKSPACE_UPDATE',
    targetType: 'Workspace',
    targetId: workspaceId,
    metadata: data as Prisma.InputJsonValue,
  });

  return {
    id: workspace.id,
    name: workspace.name,
    logo: workspace.logo,
    plan: workspace.plan,
    remainingCredit: workspace.remainingCredit,
    monthlyQuota: workspace.monthlyQuota,
  };
};

export const deleteWorkspace = async (workspaceId: string, userId: string) => {
  await assertWorkspaceExists(workspaceId);

  await workspaceRepository.softDeleteWorkspace(workspaceId);

  await auditService.recordAuditLog({
    actorId: userId,
    action: 'WORKSPACE_DELETE',
    targetType: 'Workspace',
    targetId: workspaceId,
  });

  return { success: true };
};

export const uploadWorkspaceLogo = async (
  workspaceId: string,
  userId: string,
  file?: Express.Multer.File
) => {
  if (!file) {
    throw new BadRequestError('Vui lòng chọn ảnh logo');
  }

  await assertWorkspaceExists(workspaceId);

  const logo = await uploadImageBuffer(file.buffer, `marka/workspaces/${workspaceId}`);

  await workspaceRepository.updateWorkspace(workspaceId, { logo });

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'WORKSPACE_LOGO_UPDATE',
    targetType: 'Workspace',
    targetId: workspaceId,
  });

  return { logo };
};

export const listMembers = async (workspaceId: string) => {
  await assertWorkspaceExists(workspaceId);

  const [members, invites] = await Promise.all([
    workspaceRepository.findMembersByWorkspace(workspaceId),
    workspaceRepository.findPendingInvitesByWorkspace(workspaceId),
  ]);

  return {
    members: members.map((member) => ({
      memberId: member.id,
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      avatar: member.user.avatar,
      role: member.role,
      allowDirectPublish: member.allowDirectPublish,
      status: 'ACTIVE' as const,
      joinedAt: member.createdAt,
    })),
    pendingInvites: invites.map((invite) => ({
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      status: 'PENDING' as const,
      invitedAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    })),
  };
};

export const inviteMember = async (
  workspaceId: string,
  inviter: { id: string; name: string },
  data: { email: string; role: WorkspaceRole }
) => {
  const workspace = await assertWorkspaceExists(workspaceId);

  const invitedUser = await workspaceRepository.findUserByEmail(data.email);
  if (invitedUser) {
    const existingMember = await workspaceRepository.findMember(workspaceId, invitedUser.id);
    if (existingMember) {
      throw new ConflictError('Email này đã là thành viên của workspace');
    }
  }

  const activeInvite = await workspaceRepository.findActiveInviteByEmail(workspaceId, data.email);

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Đã có lời mời đang chờ → cấp lại token/hạn mới (token cũ hết hiệu lực) thay vì chặn.
  const invite = activeInvite
    ? await workspaceRepository.refreshInvite(activeInvite.id, { token, expiresAt, role: data.role })
    : await workspaceRepository.createInvite({
        email: data.email,
        workspaceId,
        role: data.role,
        token,
        expiresAt,
        invitedById: inviter.id,
      });

  const inviteUrl = `${env.APP_BASE_URL}/invites/${token}`;
  const { subject, html } = buildWorkspaceInviteEmail({
    workspaceName: workspace.name,
    inviterName: inviter.name,
    roleLabel: ROLE_LABELS[data.role],
    inviteUrl,
  });

  await sendEmail({ to: data.email, subject, html });

  await auditService.recordAuditLog({
    workspaceId,
    actorId: inviter.id,
    action: 'MEMBER_INVITED',
    targetType: 'WorkspaceInvite',
    targetId: invite.id,
    metadata: { email: data.email, role: data.role, resent: Boolean(activeInvite) },
  });

  return {
    invite: {
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
    inviteUrl,
  };
};

export const acceptInvite = async (token: string, currentUser?: { id: string; email: string }) => {
  const invite = await workspaceRepository.findInviteByToken(token);

  if (!invite || invite.workspace.deletedAt) {
    throw new NotFoundError('Lời mời không tồn tại');
  }

  if (invite.isUsed) {
    throw new ConflictError('Lời mời đã được sử dụng');
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    throw new ConflictError('Lời mời đã hết hạn');
  }

  if (!currentUser) {
    return {
      requiresRegistration: true,
      email: invite.email,
      workspaceName: invite.workspace.name,
    };
  }

  if (currentUser.email !== invite.email) {
    throw new ForbiddenError('Lời mời này dành cho một email khác');
  }

  // Đã là thành viên (ví dụ được mời lại) thì coi như hoàn tất.
  const existingMember = await workspaceRepository.findMember(invite.workspaceId, currentUser.id);
  if (existingMember) {
    await workspaceRepository.markInviteUsed(invite.id);
    return { workspaceId: invite.workspaceId, workspaceName: invite.workspace.name, alreadyMember: true };
  }

  await workspaceRepository.createMember(invite.workspaceId, currentUser.id, invite.role);
  await workspaceRepository.markInviteUsed(invite.id);

  await auditService.recordAuditLog({
    workspaceId: invite.workspaceId,
    actorId: currentUser.id,
    action: 'MEMBER_JOINED',
    targetType: 'WorkspaceMember',
    targetId: currentUser.id,
  });

  await notifyOwners(invite.workspaceId, currentUser.id, {
    workspaceId: invite.workspaceId,
    userId: currentUser.id,
    role: invite.role,
  });

  return { workspaceId: invite.workspaceId, workspaceName: invite.workspace.name };
};

export const leaveWorkspace = async (workspaceId: string, userId: string) => {
  const member = await workspaceRepository.findMember(workspaceId, userId);
  if (!member) {
    throw new NotFoundError('Bạn không phải là thành viên của workspace này');
  }

  if (member.role === 'OWNER') {
    const ownerCount = await workspaceRepository.countOwners(workspaceId);
    if (ownerCount <= 1) {
      throw new ConflictError('Bạn là Owner duy nhất. Hãy chuyển quyền hoặc xóa workspace');
    }
  }

  await workspaceRepository.deleteMember(workspaceId, userId);

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'MEMBER_LEFT',
    targetType: 'WorkspaceMember',
    targetId: userId,
  });

  return { success: true };
};

export const removeMember = async (workspaceId: string, actorId: string, targetUserId: string) => {
  const target = await workspaceRepository.findMember(workspaceId, targetUserId);
  if (!target) {
    throw new NotFoundError('Thành viên không tồn tại trong workspace');
  }

  if (target.role === 'OWNER') {
    const ownerCount = await workspaceRepository.countOwners(workspaceId);
    if (ownerCount <= 1) {
      throw new ConflictError('Không thể xóa Owner duy nhất của workspace');
    }
  }

  await workspaceRepository.deleteMember(workspaceId, targetUserId);

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'MEMBER_REMOVED',
    targetType: 'WorkspaceMember',
    targetId: targetUserId,
  });

  return { removedMemberId: targetUserId };
};

export const changeMemberRole = async (
  workspaceId: string,
  actorId: string,
  targetUserId: string,
  role: WorkspaceRole
) => {
  const target = await workspaceRepository.findMember(workspaceId, targetUserId);
  if (!target) {
    throw new NotFoundError('Thành viên không tồn tại trong workspace');
  }

  if (target.role === role) {
    return { memberId: target.id, userId: targetUserId, role };
  }

  if (target.role === 'OWNER' && role !== 'OWNER') {
    const ownerCount = await workspaceRepository.countOwners(workspaceId);
    if (ownerCount <= 1) {
      throw new ConflictError('Không thể hạ vai trò Owner duy nhất của workspace');
    }
  }

  await workspaceRepository.updateMemberRole(workspaceId, targetUserId, role);

  await auditService.recordAuditLog({
    workspaceId,
    actorId,
    action: 'MEMBER_ROLE_CHANGED',
    targetType: 'WorkspaceMember',
    targetId: targetUserId,
    metadata: { from: target.role, to: role },
  });

  return { memberId: target.id, userId: targetUserId, role };
};

export default {
  createWorkspace,
  listMyWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  uploadWorkspaceLogo,
  listMembers,
  inviteMember,
  acceptInvite,
  leaveWorkspace,
  removeMember,
  changeMemberRole,
};
