import { Request, Response } from 'express';
import authService from './auth.service.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../../utils/cookies.js';

export const register = catchAsync(async (req: Request, res: Response) => {
  const { accessToken, refreshToken: token, user } = await authService.registerUser(req.body);

  setRefreshTokenCookie(res, token);

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Đăng ký tài khoản thành công',
    data: {
      accessToken,
      user,
    },
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken: token, user } = await authService.login(email, password);

  setRefreshTokenCookie(res, token);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Đăng nhập thành công',
    data: {
      accessToken,
      user,
    },
  });
});

export const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  const { accessToken, refreshToken: token, user } = await authService.googleLogin(idToken);

  setRefreshTokenCookie(res, token);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Đăng nhập Google thành công',
    data: {
      accessToken,
      user,
    },
  });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  await authService.logout(req.user?.id);
  clearRefreshTokenCookie(res);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Đăng xuất thành công',
  });
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(token);

  setRefreshTokenCookie(res, newRefreshToken);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Làm mới token thành công',
    data: {
      accessToken,
    },
  });
});

export default {
  register,
  login,
  googleLogin,
  logout,
  refreshToken,
};
