import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import userRepository from '../user/user.repository.js';
import auditService from '../audit/audit.service.js';
import prisma from '../../config/db.js';
import env from '../../config/env.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from '../../utils/errors/index.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string | null): Promise<boolean> => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

export const registerUser = async ({ email, password, name }: RegisterInput) => {
  const existingUser = await userRepository.findUserByEmail(email);
  if (existingUser) {
    throw new ConflictError('Email này đã được đăng ký trong hệ thống');
  }

  const passwordHash = await hashPassword(password);

  const newUser = await userRepository.createUser({
    email,
    passwordHash,
    name,
  });

  await auditService.recordAuditLog({
    workspaceId: newUser.defaultWorkspace?.id,
    actorId: newUser.id,
    action: 'USER_REGISTER',
    targetType: 'User',
    targetId: newUser.id,
    metadata: { email: newUser.email, name: newUser.name },
  });

  // Auto-login sau khi đăng ký: cấp luôn cặp token giống luồng login.
  const tokenPayload = {
    id: newUser.id,
    email: newUser.email,
    systemRole: newUser.systemRole,
    tokenVersion: newUser.tokenVersion,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: newUser.id, tokenVersion: newUser.tokenVersion });

  return {
    accessToken,
    refreshToken,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      avatar: newUser.avatar,
      systemRole: newUser.systemRole,
      emailVerified: newUser.emailVerified,
      workspaces: newUser.defaultWorkspace
        ? [
            {
              id: newUser.defaultWorkspace.id,
              name: newUser.defaultWorkspace.name,
              logo: newUser.defaultWorkspace.logo,
              role: 'OWNER' as const,
              plan: newUser.defaultWorkspace.plan,
              remainingCredit: newUser.defaultWorkspace.remainingCredit,
            },
          ]
        : [],
    },
  };
};

export const login = async (email: string, password: string) => {
  const user = await userRepository.findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
  }

  if (user.isSuspended) {
    throw new ForbiddenError('Tài khoản của bạn đã bị tạm khóa');
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    systemRole: user.systemRole,
    tokenVersion: user.tokenVersion,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user.id, tokenVersion: user.tokenVersion });

  await auditService.recordAuditLog({
    actorId: user.id,
    action: 'USER_LOGIN',
    targetType: 'User',
    targetId: user.id,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      systemRole: user.systemRole,
      emailVerified: user.emailVerified,
      workspaces: user.workspaceMembers.map((member) => ({
        id: member.workspace.id,
        name: member.workspace.name,
        logo: member.workspace.logo,
        role: member.role,
        plan: member.workspace.plan,
        remainingCredit: member.workspace.remainingCredit,
      })),
    },
  };
};

export const googleLogin = async (idToken: string) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError('Xác thực tài khoản Google không hợp lệ');
  }

  if (!payload || !payload.email) {
    throw new UnauthorizedError('Không thể lấy thông tin email từ Google');
  }

  const { email, name, picture, sub: googleId } = payload;

  let user = await userRepository.findUserByEmail(email);

  if (user && user.isSuspended) {
    throw new ForbiddenError('Tài khoản của bạn đã bị tạm khóa');
  }

  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name: name || 'Google User',
          avatar: picture || null,
          authProvider: 'GOOGLE',
          googleId,
          emailVerified: true,
          systemRole: 'USER',
        },
      });

      const defaultWorkspace = await tx.workspace.create({
        data: {
          name: `Workspace của ${newUser.name}`,
          plan: 'FREE',
          remainingCredit: 100,
          monthlyQuota: 100,
        },
      });

      await tx.workspaceMember.create({
        data: {
          userId: newUser.id,
          workspaceId: defaultWorkspace.id,
          role: 'OWNER',
          allowDirectPublish: true,
        },
      });

      return {
        ...newUser,
        workspaceMembers: [
          {
            id: 'default',
            workspaceId: defaultWorkspace.id,
            userId: newUser.id,
            role: 'OWNER' as const,
            allowDirectPublish: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            workspace: defaultWorkspace,
          },
        ],
      };
    });
  } else {
    if (!user.googleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatar: user.avatar || picture || null,
          emailVerified: true,
        },
      });
    }
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    systemRole: user.systemRole,
    tokenVersion: user.tokenVersion,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken({ id: user.id, tokenVersion: user.tokenVersion });

  await auditService.recordAuditLog({
    actorId: user.id,
    action: 'USER_GOOGLE_LOGIN',
    targetType: 'User',
    targetId: user.id,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar || picture || null,
      systemRole: user.systemRole,
      emailVerified: true,
      workspaces: user.workspaceMembers.map((member) => ({
        id: member.workspace.id,
        name: member.workspace.name,
        logo: member.workspace.logo,
        role: member.role,
        plan: member.workspace.plan,
        remainingCredit: member.workspace.remainingCredit,
      })),
    },
  };
};

export const logout = async (userId?: string) => {
  if (userId) {
    await userRepository.incrementTokenVersion(userId);
    await auditService.recordAuditLog({
      actorId: userId,
      action: 'USER_LOGOUT',
      targetType: 'User',
      targetId: userId,
    });
  }
  return true;
};

export const refreshToken = async (token?: string) => {
  if (!token) throw new UnauthorizedError('Refresh token không được để trống');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError('Refresh token không hợp lệ hoặc đã hết hạn');
  }

  const user = await userRepository.findUserById(decoded.id);
  if (!user || user.tokenVersion !== decoded.tokenVersion) {
    throw new UnauthorizedError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
  }

  if (user.isSuspended) {
    throw new ForbiddenError('Tài khoản đã bị tạm khóa');
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    systemRole: user.systemRole,
    tokenVersion: user.tokenVersion,
  };

  return {
    accessToken: generateAccessToken(tokenPayload),
    refreshToken: generateRefreshToken({ id: user.id, tokenVersion: user.tokenVersion }),
  };
};

export default {
  hashPassword,
  verifyPassword,
  registerUser,
  login,
  googleLogin,
  logout,
  refreshToken,
};
