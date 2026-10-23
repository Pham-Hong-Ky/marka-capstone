import { Request, Response, NextFunction } from 'express';
import type { SystemRole, WorkspaceRole } from '@prisma/client';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../utils/errors/index.js';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import workspaceRepository from '../modules/workspace/workspace.repository.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  systemRole: SystemRole;
  tokenVersion: number;
  isSuspended: boolean;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      workspaceId?: string;
      workspaceRole?: WorkspaceRole;
    }
  }
}

export const loadUserFromToken = async (token: string): Promise<AuthenticatedUser> => {
  let decoded;

  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      systemRole: true,
      tokenVersion: true,
      isSuspended: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('Tài khoản không tồn tại');
  }

  if (user.isSuspended) {
    throw new ForbiddenError('Tài khoản của bạn đã bị tạm khóa');
  }

  if (user.tokenVersion !== decoded.tokenVersion) {
    throw new UnauthorizedError('Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại');
  }

  return user;
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Vui lòng đăng nhập để tiếp tục');
    }

    req.user = await loadUserFromToken(authHeader.split(' ')[1]);
    next();
  } catch (error) {
    next(error);
  }
};

// Route công khai: không có token thì coi là khách. Nhưng nếu có token mà sai/hết hạn
// thì trả 401 để client làm mới phiên, tránh âm thầm hạ quyền người đã đăng nhập
// thành khách (ví dụ trang nhận lời mời sẽ hiện nhầm yêu cầu đăng ký).
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  try {
    req.user = await loadUserFromToken(authHeader.split(' ')[1]);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Token không hợp lệ ở optionalAuth: ${message}`);
    next(error);
  }
};

export const requireRoles = (...allowedRoles: SystemRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Yêu cầu xác thực'));
    }

    if (!allowedRoles.includes(req.user.systemRole)) {
      return next(new ForbiddenError('Bạn không có quyền thực hiện hành động này'));
    }

    next();
  };
};

export const requireWorkspaceRole = (...allowedRoles: WorkspaceRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Yêu cầu xác thực');
      }

      const workspaceId =
        (req.headers['x-workspace-id'] as string) ||
        req.params.workspaceId ||
        (req.query.workspaceId as string) ||
        req.body?.workspaceId;

      if (!workspaceId) {
        throw new BadRequestError('Vui lòng cung cấp Workspace ID (qua header x-workspace-id hoặc params)');
      }

      // Chặn lệch workspace giữa header và URL: quyền được kiểm theo một workspace
      // nhưng thao tác lại nhắm workspace khác là lỗ hổng vượt tenant.
      const headerWorkspaceId = req.headers['x-workspace-id'] as string | undefined;
      if (headerWorkspaceId && req.params.workspaceId && headerWorkspaceId !== req.params.workspaceId) {
        throw new ForbiddenError('Workspace ID không khớp giữa header và URL');
      }

      // System Admin có toàn quyền như Owner trên mọi workspace.
      if (req.user.systemRole === 'SYSTEM_ADMIN') {
        req.workspaceId = workspaceId;
        req.workspaceRole = 'OWNER';
        return next();
      }

      const member = await workspaceRepository.findMember(workspaceId, req.user.id);

      if (!member) {
        throw new ForbiddenError('Bạn không phải là thành viên của Workspace này');
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(member.role)) {
        throw new ForbiddenError('Bạn không có quyền thực hiện hành động này trong Workspace');
      }

      req.workspaceId = workspaceId;
      req.workspaceRole = member.role;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export default {
  requireAuth,
  requireRoles,
  requireWorkspaceRole,
  optionalAuth,
};
