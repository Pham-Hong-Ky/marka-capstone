import httpClient from '../httpClient';
import { unwrap } from '../http';
import type { ApiResponse } from '@/types';
import type {
  ChangePasswordPayload,
  DeleteAccountPayload,
  UpdateProfilePayload,
  UpdateProfileResult,
} from './account.types';

export const accountService = {
  updateProfile: async (payload: UpdateProfilePayload): Promise<UpdateProfileResult> =>
    unwrap(await httpClient.patch<ApiResponse<UpdateProfileResult>>('/users/me', payload)),

  uploadAvatar: async (file: File): Promise<UpdateProfileResult> => {
    const form = new FormData();
    form.append('file', file);

    return unwrap(
      await httpClient.post<ApiResponse<UpdateProfileResult>>('/users/me/avatar', form, {
        headers: { 'Content-Type': undefined },
      })
    );
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await httpClient.patch('/users/me/password', payload);
  },

  logoutAll: async (): Promise<void> => {
    await httpClient.post('/users/me/logout-all');
  },

  deleteAccount: async (payload: DeleteAccountPayload): Promise<void> => {
    await httpClient.delete('/users/me', { data: payload });
  },
};

export default accountService;
