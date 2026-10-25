import workspaceRepository from '../workspace/workspace.repository.js';
import notificationRepository from '../notification/notification.repository.js';
import { mailerClient } from '../../utils/mailer.client.js';
import { buildPostSubmittedEmail, buildPostReviewedEmail } from '../../templates/postReviewEmail.js';

export const notifyPostSubmitted = async (params: {
  workspaceId: string;
  postId: string;
  postTitle: string;
  actorId: string;
  actorName: string;
}) => {
  const { workspaceId, postId, postTitle, actorId, actorName } = params;

  const ownerIds = (await workspaceRepository.findOwnerIds(workspaceId)).filter((id) => id !== actorId);
  if (ownerIds.length === 0) {
    return;
  }

  const workspace = await workspaceRepository.findWorkspaceById(workspaceId);
  const workspaceName = workspace?.name ?? '';

  await Promise.all(
    ownerIds.map(async (ownerId) => {
      await notificationRepository.createNotification({
        userId: ownerId,
        workspaceId,
        type: 'POST_SUBMITTED',
        payload: { postId, postTitle, submittedById: actorId },
      });

      const owner = await workspaceRepository.findUserById(ownerId);
      if (!owner) {
        return;
      }

      const { subject, html } = buildPostSubmittedEmail({ workspaceName, postTitle, submitterName: actorName });
      await mailerClient.sendEmail({ to: owner.email, subject, html });
    })
  );
};

export const notifyPostReviewed = async (params: {
  workspaceId: string;
  postId: string;
  postTitle: string;
  authorId: string | null;
  approved: boolean;
  rejectReason?: string | null;
}) => {
  const { workspaceId, postId, postTitle, authorId, approved, rejectReason = null } = params;
  if (!authorId) {
    return;
  }

  const workspace = await workspaceRepository.findWorkspaceById(workspaceId);
  const workspaceName = workspace?.name ?? '';

  await notificationRepository.createNotification({
    userId: authorId,
    workspaceId,
    type: approved ? 'POST_APPROVED' : 'POST_REJECTED',
    payload: { postId, postTitle, approved, reason: rejectReason },
  });

  const author = await workspaceRepository.findUserById(authorId);
  if (!author) {
    return;
  }

  const { subject, html } = buildPostReviewedEmail({ workspaceName, postTitle, approved, rejectReason });
  await mailerClient.sendEmail({ to: author.email, subject, html });
};

export const notifyTaskAssigned = async (params: {
  workspaceId: string;
  postId: string;
  postTitle: string;
  assigneeId: string;
  actorId: string;
  dueAt: Date | null;
}) => {
  const { workspaceId, postId, postTitle, assigneeId, actorId, dueAt } = params;
  if (assigneeId === actorId) {
    return;
  }

  await notificationRepository.createNotification({
    userId: assigneeId,
    workspaceId,
    type: 'TASK_ASSIGNED',
    payload: { postId, postTitle, dueAt: dueAt?.toISOString() ?? null, assignedById: actorId },
  });
};

export const notifyTaskStatusChanged = async (params: {
  workspaceId: string;
  postId: string;
  postTitle: string;
  actorId: string;
  authorId: string | null;
  taskStatus: string;
}) => {
  const { workspaceId, postId, postTitle, actorId, authorId, taskStatus } = params;

  const ownerIds = await workspaceRepository.findOwnerIds(workspaceId);
  const recipientIds = new Set([...ownerIds, ...(authorId ? [authorId] : [])]);
  recipientIds.delete(actorId);

  await Promise.all(
    [...recipientIds].map((userId) =>
      notificationRepository.createNotification({
        userId,
        workspaceId,
        type: 'TASK_STATUS_CHANGED',
        payload: { postId, postTitle, taskStatus, changedById: actorId },
      })
    )
  );
};

export default {
  notifyPostSubmitted,
  notifyPostReviewed,
  notifyTaskAssigned,
  notifyTaskStatusChanged,
};
