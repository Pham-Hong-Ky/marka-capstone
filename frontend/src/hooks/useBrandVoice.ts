import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { brandVoiceService, type BrandVoice } from '@/services/brandvoice';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/error';

export const useBrandVoice = (workspaceId: string | null) =>
  useQuery({
    queryKey: queryKeys.brandVoice.detail(workspaceId ?? ''),
    queryFn: () => brandVoiceService.getBrandVoice(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

export const useUpdateBrandVoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: BrandVoice }) =>
      brandVoiceService.updateBrandVoice(workspaceId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.brandVoice.detail(variables.workspaceId) });
      toast.success('Đã lưu Brand Voice');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
