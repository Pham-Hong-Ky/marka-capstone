import type { WorkspaceRole } from '@prisma/client';
import { ForbiddenError } from './errors/index.js';

export const assertOwnerOrSelf = (
  role: WorkspaceRole,
  targetUserId: string | null | undefined,
  userId: string,
  message: string
) => {
  if (role !== 'OWNER' && targetUserId !== userId) {
    throw new ForbiddenError(message);
  }
};

export default assertOwnerOrSelf;
