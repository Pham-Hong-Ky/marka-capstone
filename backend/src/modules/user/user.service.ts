import userRepository from './user.repository.js';
import { toAuthUser } from './user.mapper.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { cloudinaryClient } from '../../utils/cloudinary.client.js';
import auditService from '../audit/audit.service.js';
import {
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ConflictError,
} from '../../utils/errors/index.js';

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

  await userRepository.updatePasswordAndBumpTokenVersion(userId, passwordHash);

  await auditService.recordAuditLog({
    actorId: userId,
    action: 'USER_CHANGE_PASSWORD',
    targetType: 'User',
    targetId: userId,
  });

  return true;
};

export const uploadAvatar = async (userId: string, file?: Express.Multer.File) => {
  if (!file) {
    throw new BadRequestError('Vui lòng chọn ảnh đại diện');
  }

  const avatar = await cloudinaryClient.uploadImageBuffer(
    file.buffer,
    `marka/users/${userId}/avatar`
  );
  const updatedUser = await userRepository.updateUser(userId, { avatar });

  await auditService.recordAuditLog({
    actorId: userId,
    action: 'USER_UPDATE_PROFILE',
    targetType: 'User',
    targetId: userId,
    metadata: { avatar: true },
  });

  return updatedUser;
};

export const logoutAll = async (userId: string) => {
  await userRepository.incrementTokenVersion(userId);

  await auditService.recordAuditLog({
    actorId: userId,
    action: 'USER_LOGOUT_ALL',
    targetType: 'User',
    targetId: userId,
  });

  return true;
};

export const deleteAccount = async (
  userId: string,
  input: { password?: string; confirm: string }
) => {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError('Người dùng không tồn tại');
  }

  if (user.passwordHash && !(await verifyPassword(input.password ?? '', user.passwordHash))) {
    throw new UnauthorizedError('Mật khẩu không chính xác');
  }

  const soleOwnedWorkspaces = await userRepository.findSoleOwnedWorkspaces(userId);
  if (soleOwnedWorkspaces.length > 0) {
    throw new ConflictError(
      `Bạn là Owner duy nhất của workspace "${soleOwnedWorkspaces[0]}". Hãy chuyển quyền hoặc xoá workspace trước khi xoá tài khoản.`
    );
  }

  await userRepository.softDeleteUser(userId);

  await auditService.recordAuditLog({
    actorId: userId,
    action: 'USER_DELETE',
    targetType: 'User',
    targetId: userId,
  });

  return true;
};

export default {
  getProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  logoutAll,
  deleteAccount,
};
