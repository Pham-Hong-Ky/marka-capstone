import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { billingService, type CreateBillingOrderPayload } from '@/services/billing';
import { getErrorMessage } from '@/utils/error';

export const billingKeys = {
  overview: (workspaceId: string) => ['billing', workspaceId] as const,
  transactions: (workspaceId: string, page: number, limit: number) =>
    ['billing', workspaceId, 'transactions', page, limit] as const,
  order: (workspaceId: string, orderId: string) =>
    ['billing', workspaceId, 'order', orderId] as const,
};

export const useBilling = (workspaceId: string | null) =>
  useQuery({
    queryKey: billingKeys.overview(workspaceId ?? ''),
    queryFn: () => billingService.getBilling(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

export const useCreditTransactions = (workspaceId: string | null, page: number, limit = 10) =>
  useQuery({
    queryKey: billingKeys.transactions(workspaceId ?? '', page, limit),
    queryFn: () => billingService.listTransactions(workspaceId as string, page, limit),
    enabled: Boolean(workspaceId),
  });

export const useBillingOrder = (workspaceId: string | null, orderId: string | null) =>
  useQuery({
    queryKey: billingKeys.order(workspaceId ?? '', orderId ?? ''),
    queryFn: () => billingService.getOrder(workspaceId as string, orderId as string),
    enabled: Boolean(workspaceId && orderId),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 3000 : false),
    refetchIntervalInBackground: false,
  });

export const useCreateBillingOrder = () =>
  useMutation({
    mutationFn: ({
      workspaceId,
      payload,
    }: {
      workspaceId: string;
      payload: CreateBillingOrderPayload;
    }) => billingService.createOrder(workspaceId, payload),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

export const useCancelBillingOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, orderId }: { workspaceId: string; orderId: string }) =>
      billingService.cancelOrder(workspaceId, orderId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: billingKeys.order(variables.workspaceId, variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: billingKeys.overview(variables.workspaceId) });
      toast.success('Đã huỷ đơn hàng');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};

export default {
  useBilling,
  useCreditTransactions,
  useBillingOrder,
  useCreateBillingOrder,
  useCancelBillingOrder,
};
