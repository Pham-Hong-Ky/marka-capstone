import { OAuth2Client } from 'google-auth-library';
import type { User } from '@prisma/client';
import userRepository from '../user/user.repository.js';
import { toAuthUser } from '../user/user.mapper.js';
import auditService from '../audit/audit.service.js';
import env from '../../config/env.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { ConflictError, UnauthorizedError, ForbiddenError } from '../../utils/errors/index.js';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

type TokenSubject = Pick<User, 'id' | 'email' | 'systemRole' | 'tokenVersion'>;

const issueTokens = (user: TokenSubject) => ({
  accessToken: generateAccessToken({
    id: user.id,
    email: user.email,
    systemRole: user.systemRole,
    tokenVersion: user.tokenVersion,
  }),
  refreshToken: generateRefreshToken({ id: user.id, tokenVersion: user.tokenVersion }),
});

const assertNotSuspended = (user: { isSuspended: boolean }) => {
  if (user.isSuspended) {
    throw new ForbiddenError('Tài khoản của bạn đã bị tạm khóa');
  }
};

const verifyGoogleIdToken = async (idToken: string) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError('Xác thực tài khoản Google không hợp lệ');
  }

  if (!payload?.email) {
    throw new UnauthorizedError('Không thể lấy thông tin email từ Google');
  }

  // Liên kết theo email chỉ an toàn khi Google đã xác minh email đó, nếu không sẽ bị chiếm tài khoản.
  if (!payload.email_verified) {
    throw new UnauthorizedError('Email Google chưa được xác minh');
  }

  return {
    email: payload.email.toLowerCase(),
    name: payload.name,
    avatar: payload.picture ?? null,
    googleId: payload.sub,
  };
};

export const registerUser = async ({ email, password, name }: RegisterInput) => {
  const existingUser = await userRepository.findUserByEmail(email);
  if (existingUser) {
    throw new ConflictError('Email này đã được đăng ký trong hệ thống');
  }

  const user = await userRepository.createUserWithDefaultWorkspace({
    email,
    name,
    passwordHash: await hashPassword(password),
    authProvider: 'LOCAL',
  });

  await auditService.recordAuditLog({
    workspaceId: user.workspaceMembers[0]?.workspaceId,
    actorId: user.id,
    action: 'USER_REGISTER',
    targetType: 'User',
    targetId: user.id,
    metadata: { email: user.email, name: user.name },
  });

  return { ...issueTokens(user), user: toAuthUser(user) };
};

export const login = async (email: string, password: string) => {
  const user = await userRepository.findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
  }
  assertNotSuspended(user);

  await auditService.recordAuditLog({
    actorId: user.id,
    action: 'USER_LOGIN',
    targetType: 'User',
    targetId: user.id,
  });

  return { ...issueTokens(user), user: toAuthUser(user) };
};

const findOrCreateGoogleUser = async (profile: Awaited<ReturnType<typeof verifyGoogleIdToken>>) => {
  const existingUser = await userRepository.findUserByEmail(profile.email);

  if (!existingUser) {
    return userRepository.createUserWithDefaultWorkspace({
      email: profile.email,
      name: profile.name || 'Google User',
      avatar: profile.avatar,
      authProvider: 'GOOGLE',
      googleId: profile.googleId,
      emailVerified: true,
    });
  }

  assertNotSuspended(existingUser);

  if (existingUser.googleId) {
    return existingUser;
  }

  return userRepository.linkGoogleAccount(existingUser.id, {
    googleId: profile.googleId,
    avatar: existingUser.avatar || profile.avatar,
  });
};

export const googleLogin = async (idToken: string) => {
  const profile = await verifyGoogleIdToken(idToken);
  const user = await findOrCreateGoogleUser(profile);

  await auditService.recordAuditLog({
    actorId: user.id,
    action: 'USER_GOOGLE_LOGIN',
    targetType: 'User',
    targetId: user.id,
  });

  return { ...issueTokens(user), user: toAuthUser(user) };
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
  assertNotSuspended(user);

  return issueTokens(user);
};

export default {
  registerUser,
  login,
  googleLogin,
  logout,
  refreshToken,
};
