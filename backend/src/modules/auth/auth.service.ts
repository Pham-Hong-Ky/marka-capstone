import type { User } from '@prisma/client';
import userRepository, { type CreateUserData } from '../user/user.repository.js';
import { toAuthUser } from '../user/user.mapper.js';
import auditService from '../audit/audit.service.js';
import { googleOAuthClient, type GoogleProfile } from './google-oauth.client.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { withTransaction } from '../../utils/transaction.js';
import { ConflictError, UnauthorizedError, ForbiddenError } from '../../utils/errors/index.js';
import workspaceRepository from '../workspace/workspace.repository.js';

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

const createUserWithDefaultWorkspace = async (data: CreateUserData) =>
  withTransaction(async (tx) => {
    const user = await userRepository.createUser(data, tx);
    await workspaceRepository.createWorkspaceWithOwner(
      { name: `Workspace của ${user.name}` },
      user.id,
      tx
    );

    return (await userRepository.findUserById(user.id, tx))!;
  });

export const registerUser = async ({ email, password, name }: RegisterInput) => {
  const existingUser = await userRepository.findUserByEmailIncludingDeleted(email);
  if (existingUser) {
    throw new ConflictError(
      existingUser.deletedAt
        ? 'Email này thuộc tài khoản đã xoá. Vui lòng dùng email khác.'
        : 'Email này đã được đăng ký trong hệ thống'
    );
  }

  const user = await createUserWithDefaultWorkspace({
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

const findOrCreateGoogleUser = async (profile: GoogleProfile) => {
  const existingUser = await userRepository.findUserByEmail(profile.email);

  if (!existingUser) {
    const deletedUser = await userRepository.findUserByEmailIncludingDeleted(profile.email);
    if (deletedUser) {
      throw new ConflictError(
        'Email này thuộc tài khoản đã xoá. Vui lòng dùng email Google khác.'
      );
    }

    return createUserWithDefaultWorkspace({
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

  // Không auto-link tài khoản local chưa xác minh email: kẻ tấn công có thể
  // đăng ký trước email của nạn nhân rồi chiếm tài khoản khi nạn nhân login Google.
  if (!existingUser.emailVerified) {
    throw new ConflictError(
      'Email này đã được đăng ký bằng mật khẩu. Vui lòng đăng nhập bằng mật khẩu.'
    );
  }

  return userRepository.linkGoogleAccount(existingUser.id, {
    googleId: profile.googleId,
    avatar: existingUser.avatar || profile.avatar,
  });
};

export const googleLogin = async (idToken: string) => {
  const profile = await googleOAuthClient.verifyIdToken(idToken);
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
