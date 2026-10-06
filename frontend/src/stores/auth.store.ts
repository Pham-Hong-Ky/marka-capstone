import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, AuthUser } from '@/types';

const ACCESS_TOKEN_KEY = 'access_token';
const ACTIVE_WORKSPACE_KEY = 'active_workspace_id';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  activeWorkspaceId: string | null;
  setSession: (session: AuthSession) => void;
  updateUser: (user: AuthUser) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      activeWorkspaceId: null,

      setSession: (session) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);

        const workspaceId = get().activeWorkspaceId ?? session.user.workspaces[0]?.id ?? null;
        if (workspaceId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);

        set({
          accessToken: session.accessToken,
          user: session.user,
          activeWorkspaceId: workspaceId,
        });
      },

      updateUser: (user) =>
        set((state) => {
          const workspaceId = state.activeWorkspaceId ?? user.workspaces[0]?.id ?? null;
          if (workspaceId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
          return { user, activeWorkspaceId: workspaceId };
        }),

      setActiveWorkspace: (workspaceId) => {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
        set({ activeWorkspaceId: workspaceId });
      },

      clearSession: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
        set({ accessToken: null, user: null, activeWorkspaceId: null });
      },
    }),
    {
      name: 'marka-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);

export const useIsAuthenticated = () => useAuthStore((state) => Boolean(state.user));

// httpClient phát sự kiện này khi refresh token thất bại để buộc đăng xuất.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().clearSession();
  });
}
