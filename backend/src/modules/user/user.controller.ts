import { Request, Response } from 'express';
import userService from './user.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const profile = await userService.getProfile(req.user!.id);
  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy thông tin tài khoản thành công',
    data: profile,
  });
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const updatedUser = await userService.updateProfile(req.user!.id, req.body);
  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Cập nhật thông tin tài khoản thành công',
    data: updatedUser,
  });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  await userService.changePassword(req.user!.id, oldPassword, newPassword);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác',
  });
});

export default {
  getMe,
  updateProfile,
  changePassword,
};
