import bcrypt from 'bcrypt';
import userRepository from './user.repository.js';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors/index.js';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string | null): Promise<boolean> => {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
};

export const getProfile = async (userId: string) => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    systemRole: user.systemRole,
    emailVerified: user.emailVerified,
    workspaces: user.workspaceMembers.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      plan: m.workspace.plan,
      remainingCredit: m.workspace.remainingCredit,
    })),
  };
};

export const updateProfile = async (userId: string, data: { name?: string; avatar?: string | null }) => {
  const updatedUser = await userRepository.updateUser(userId, data);

  await userRepository.createAuditLog({
    actorId: userId,
    action: 'USER_UPDATE_PROFILE',
    targetType: 'User',
    targetId: userId,
  });

  return updatedUser;
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại');
  }

  if (!user.passwordHash) {
    throw new BadRequestError('Tài khoản liên kết mạng xã hội không thể đổi mật khẩu trực tiếp');
  }

  const isPasswordValid = await verifyPassword(oldPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Mật khẩu cũ không chính xác');
  }

  const passwordHash = await hashPassword(newPassword);

  await userRepository.updateUser(userId, { passwordHash });
  await userRepository.incrementTokenVersion(userId);

  await userRepository.createAuditLog({
    actorId: userId,
    action: 'USER_CHANGE_PASSWORD',
    targetType: 'User',
    targetId: userId,
  });

  return true;
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  hashPassword,
  verifyPassword,
};
