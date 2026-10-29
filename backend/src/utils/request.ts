import type { Request } from 'express';
import { BadRequestError } from './errors/index.js';

export const getWorkspaceId = (req: Request): string => {
  if (!req.workspaceId) {
    throw new BadRequestError('Vui lòng cung cấp Workspace ID');
  }
  return req.workspaceId;
};

export default { getWorkspaceId };
