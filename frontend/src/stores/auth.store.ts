import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '@/lib/queryClient';
import { authStorage, STORAGE_KEYS } from '@/lib/storage';
import type { AuthSession, AuthUser } from '@/services/auth';

interface AuthState {
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
      user: null,
      activeWorkspaceId: null,

      setSession: (session) => {
        authStorage.setAccessToken(session.accessToken);

        const currentWorkspaceId = get().activeWorkspaceId;
        const stillMember = session.user.workspaces.some(
          (workspace) => workspace.id === currentWorkspaceId
        );
        const workspaceId =
          (stillMember ? currentWorkspaceId : null) ?? session.user.workspaces[0]?.id ?? null;

        if (workspaceId) authStorage.setActiveWorkspaceId(workspaceId);
        else authStorage.clearActiveWorkspaceId();

        set({
          user: session.user,
          activeWorkspaceId: workspaceId,
        });
      },

      updateUser: (user) =>
        set((state) => {
          const stillMember = user.workspaces.some(
            (workspace) => workspace.id === state.activeWorkspaceId
          );
          const workspaceId =
            (stillMember ? state.activeWorkspaceId : null) ?? user.workspaces[0]?.id ?? null;

          if (workspaceId) {
            authStorage.setActiveWorkspaceId(workspaceId);
          } else {
            authStorage.clearActiveWorkspaceId();
          }

          return { user, activeWorkspaceId: workspaceId };
        }),

      setActiveWorkspace: (workspaceId) => {
        authStorage.setActiveWorkspaceId(workspaceId);
        set({ activeWorkspaceId: workspaceId });
      },

      clearSession: () => {
        authStorage.clearAccessToken();
        authStorage.clearActiveWorkspaceId();
        set({ user: null, activeWorkspaceId: null });
      },
    }),
    {
      name: STORAGE_KEYS.auth,
      partialize: (state) => ({
        user: state.user,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = { ...(persistedState as Record<string, unknown>) };
        delete persisted.accessToken;
        return { ...currentState, ...persisted } as AuthState;
      },
    }
  )
);

export const useIsAuthenticated = () => useAuthStore((state) => Boolean(state.user));

// httpClient phát sự kiện này khi refresh token thất bại để buộc đăng xuất.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.getState().clearSession();
    queryClient.clear();
  });
}
