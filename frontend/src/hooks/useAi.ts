import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { aiService, isAiTerminal, type StartImagePayload, type StartTextPayload } from '@/services/ai';
import { syncSessionUser } from './useWorkspace';
import { getErrorMessage } from '@/utils/error';

export const aiKeys = {
  generation: (workspaceId: string, generationId: string) =>
    ['ai-generation', workspaceId, generationId] as const,
};

export const useStartAiText = () =>
  useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: StartTextPayload }) =>
      aiService.startText(workspaceId, payload),
    onSuccess: () => {
      void syncSessionUser();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useStartAiImage = () =>
  useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: StartImagePayload }) =>
      aiService.startImage(workspaceId, payload),
    onSuccess: () => {
      void syncSessionUser();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useAiGeneration = (workspaceId: string | null, generationId: string | null) =>
  useQuery({
    queryKey: aiKeys.generation(workspaceId ?? '', generationId ?? ''),
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
