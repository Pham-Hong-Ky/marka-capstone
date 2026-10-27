import type { SystemRole } from '@/services/auth';

export interface UpdateProfilePayload {
  name?: string;
  avatar?: string | null;
}

export interface UpdateProfileResult {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  systemRole: SystemRole;
  emailVerified: boolean;
  updatedAt: string;
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export interface DeleteAccountPayload {
  password?: string;
  confirm: 'XOA';
}
