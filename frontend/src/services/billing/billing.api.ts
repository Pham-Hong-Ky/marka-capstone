import httpClient from '../httpClient';
import { unwrap, unwrapPaginated } from '../http';
import type { ApiResponse } from '@/types';
import type {
  BillingOrder,
  BillingOverview,
  BillingPaginationMeta,
  BillingTransactionsResult,
  CreateBillingOrderPayload,
  CreditTransaction,
} from './billing.types';

const base = (workspaceId: string) => `/workspaces/${workspaceId}/billing`;

export const getBilling = async (workspaceId: string): Promise<BillingOverview> =>
  unwrap(await httpClient.get<ApiResponse<BillingOverview>>(base(workspaceId)));

export const listTransactions = async (
  workspaceId: string,
  page: number,
  limit: number
): Promise<BillingTransactionsResult> => {
  const response = await httpClient.get<
    ApiResponse<{ transactions: CreditTransaction[] }, BillingPaginationMeta>
  >(`${base(workspaceId)}/transactions`, { params: { page, limit } });
  const { data, meta } = unwrapPaginated(response);

  return { transactions: data.transactions, meta };
};

export const createOrder = async (
  workspaceId: string,
  payload: CreateBillingOrderPayload
): Promise<BillingOrder> => {
  const data = unwrap(
    await httpClient.post<ApiResponse<{ order: BillingOrder }>>(`${base(workspaceId)}/orders`, payload)
  );
  return data.order;
};

export const getOrder = async (workspaceId: string, orderId: string): Promise<BillingOrder> => {
  const data = unwrap(
    await httpClient.get<ApiResponse<{ order: BillingOrder }>>(
      `${base(workspaceId)}/orders/${orderId}`
    )
  );
  return data.order;
};

export const cancelOrder = async (workspaceId: string, orderId: string): Promise<void> => {
  await httpClient.post(`${base(workspaceId)}/orders/${orderId}/cancel`);
};

export default {
  getBilling,
  listTransactions,
  createOrder,
  getOrder,
  cancelOrder,
};
