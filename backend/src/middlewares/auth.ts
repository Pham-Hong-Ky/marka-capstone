import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../utils/errors/index.js';
import prisma from '../config/db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  systemRole: string;
  tokenVersion: number;
  isSuspended: boolean;
  emailVerified: boolean;
}

export interface WorkspaceMemberInfo {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'CONTENT_CREATOR';
  allowDirectPublish: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      workspaceId?: string;
      workspaceMember?: WorkspaceMemberInfo;
    }
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Vui lòng đăng nhập để tiếp tục');
    }

    const token = authHeader.split(' ')[1];
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

    req.user = user as AuthenticatedUser;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRoles = (...allowedRoles: string[]) => {
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

export const requireWorkspaceRole = (...allowedRoles: ('OWNER' | 'CONTENT_CREATOR')[]) => {
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

      // System Admin có toàn quyền truy cập
      if (req.user.systemRole === 'SYSTEM_ADMIN') {
        req.workspaceId = workspaceId;
        return next();
      }

      const member = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.user.id,
            workspaceId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenError('Bạn không phải là thành viên của Workspace này');
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(member.role as 'OWNER' | 'CONTENT_CREATOR')) {
        throw new ForbiddenError('Bạn không có quyền thực hiện hành động này trong Workspace');
      }

      req.workspaceId = workspaceId;
      req.workspaceMember = member as WorkspaceMemberInfo;
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
};
