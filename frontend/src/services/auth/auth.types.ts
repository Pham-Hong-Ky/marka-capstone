export type SystemRole = 'SYSTEM_ADMIN' | 'USER';

export type WorkspaceRole = 'OWNER' | 'CONTENT_CREATOR';

export type WorkspacePlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface UserWorkspace {
  id: string;
  name: string;
  logo: string | null;
  role: WorkspaceRole;
  plan: WorkspacePlan;
  remainingCredit: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  systemRole: SystemRole;
  emailVerified: boolean;
  workspaces: UserWorkspace[];
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface GoogleLoginPayload {
  idToken: string;
}
