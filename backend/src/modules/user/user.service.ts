import userRepository from './user.repository.js';
import { toAuthUser } from './user.mapper.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import auditService from '../audit/audit.service.js';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../utils/errors/index.js';

export const getProfile = async (userId: string) => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại');
  }

  return toAuthUser(user);
};

export const updateProfile = async (userId: string, data: { name?: string; avatar?: string | null }) => {
  const updatedUser = await userRepository.updateUser(userId, data);

  await auditService.recordAuditLog({
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

  await auditService.recordAuditLog({
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
};
