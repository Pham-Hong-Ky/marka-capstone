import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  AuthSession,
  AuthUser,
  GoogleLoginPayload,
  LoginPayload,
  RegisterPayload,
} from './auth.types';

export const login = async (payload: LoginPayload): Promise<AuthSession> =>
  unwrap(await httpClient.post<ApiResponse<AuthSession>>('/auth/login', payload));

export const register = async (payload: RegisterPayload): Promise<AuthSession> =>
  unwrap(await httpClient.post<ApiResponse<AuthSession>>('/auth/register', payload));

export const googleLogin = async (payload: GoogleLoginPayload): Promise<AuthSession> =>
  unwrap(await httpClient.post<ApiResponse<AuthSession>>('/auth/google', payload));

export const logout = async (): Promise<void> => {
  await httpClient.post('/auth/logout', {});
};

export const getMe = async (): Promise<AuthUser> =>
  unwrap(await httpClient.get<ApiResponse<AuthUser>>('/users/me'));

export default { login, register, googleLogin, logout, getMe };
