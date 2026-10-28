import type { PaginationMeta } from '@/types';

export type BillingOrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type CreditFlowType = 'INFLOW' | 'OUTFLOW';
export type CreditActionType =
  | 'GEN_TEXT'
  | 'GEN_IMAGE'
  | 'REGEN'
  | 'SCORE'
  | 'TOP_UP'
  | 'RESET'
  | 'REFUND';

export interface CreditPackage {
  id: string;
  name: string;
  description: string | null;
  creditAmount: number;
  price: number;
  sortOrder: number;
}

export interface BillingOverview {
  remainingCredit: number;
  packages: CreditPackage[];
}

export interface CreditTransaction {
  id: string;
  type: CreditFlowType;
  action: CreditActionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export type BillingPaginationMeta = PaginationMeta;

export interface BillingTransactionsResult {
  transactions: CreditTransaction[];
  meta: BillingPaginationMeta;
}

export interface BillingOrder {
  id: string;
  orderCode: string;
  amount: number;
  creditAmount: number | null;
  packageId: string | null;
  status: BillingOrderStatus;
  checkoutUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateBillingOrderPayload {
  packageId: string;
}
