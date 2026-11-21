import { useMutation, useQuery } from '@tanstack/react-query';
import { aiService, isAiTerminal, type StartPostPayload } from '@/services/ai';
import { queryKeys } from '@/lib/queryKeys';
import { syncSessionUser } from './useWorkspace';

const GENERATION_POLL_INTERVAL_MS = 1500;

export const useStartAiPost = () =>
  useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: StartPostPayload }) =>
      aiService.startPost(workspaceId, payload),
    onSuccess: () => {
      void syncSessionUser();
    },
  });

// Một request cho cả lô generation để không vượt giới hạn request/phút của workspace.
export const useAiGenerations = (workspaceId: string | null, generationIds: string[]) =>
  useQuery({
    queryKey: queryKeys.ai.generations(workspaceId ?? '', generationIds),
    queryFn: () => aiService.getGenerations(workspaceId as string, generationIds),
    enabled: Boolean(workspaceId) && generationIds.length > 0,
    retry: 1,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const data = query.state.data;
      return data && data.every((item) => isAiTerminal(item.status))
        ? false
        : GENERATION_POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

export default {
  useStartAiPost,
  useAiGenerations,
};
