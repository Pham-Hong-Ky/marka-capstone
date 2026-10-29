import { useMutation, useQuery } from '@tanstack/react-query';
import { aiService, isAiTerminal, type StartImagePayload, type StartTextPayload } from '@/services/ai';
import { queryKeys } from '@/lib/queryKeys';
import { syncSessionUser } from './useWorkspace';

export const useStartAiText = () =>
  useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: StartTextPayload }) =>
      aiService.startText(workspaceId, payload),
    onSuccess: () => {
      void syncSessionUser();
    },
  });

export const useStartAiImage = () =>
  useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: StartImagePayload }) =>
      aiService.startImage(workspaceId, payload),
    onSuccess: () => {
      void syncSessionUser();
    },
  });

export const useAiGeneration = (workspaceId: string | null, generationId: string | null) =>
  useQuery({
    queryKey: queryKeys.ai.generation(workspaceId ?? '', generationId ?? ''),
    queryFn: () => aiService.getGeneration(workspaceId as string, generationId as string),
    enabled: Boolean(workspaceId && generationId),
    retry: 1,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const status = query.state.data?.status;
      return status && isAiTerminal(status) ? false : 2000;
    },
    refetchIntervalInBackground: false,
  });

export default {
  useStartAiText,
  useStartAiImage,
  useAiGeneration,
};
