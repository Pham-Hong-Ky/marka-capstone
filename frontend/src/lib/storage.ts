export const STORAGE_KEYS = {
  accessToken: 'access_token',
  activeWorkspace: 'active_workspace_id',
  auth: 'marka-auth',
  theme: 'marka-theme',
  ui: 'marka-ui',
} as const;

export const authStorage = {
  getAccessToken: (): string | null => localStorage.getItem(STORAGE_KEYS.accessToken),
  setAccessToken: (token: string): void => localStorage.setItem(STORAGE_KEYS.accessToken, token),
  clearAccessToken: (): void => localStorage.removeItem(STORAGE_KEYS.accessToken),

  getActiveWorkspaceId: (): string | null => localStorage.getItem(STORAGE_KEYS.activeWorkspace),
  setActiveWorkspaceId: (workspaceId: string): void =>
    localStorage.setItem(STORAGE_KEYS.activeWorkspace, workspaceId),
  clearActiveWorkspaceId: (): void => localStorage.removeItem(STORAGE_KEYS.activeWorkspace),
};

export default authStorage;
