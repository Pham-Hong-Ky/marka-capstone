import type { CreditActionType, Prisma } from '@prisma/client';
import creditRepository from './credit.repository.js';
import { PaymentRequiredError } from '../../utils/errors/index.js';

type TransactionClient = Prisma.TransactionClient;

interface CreditMutationParams {
  workspaceId: string;
  userId: string | null;
  cost: number;
  reason: string;
}

interface ReserveCreditParams extends CreditMutationParams {
  action: Exclude<CreditActionType, 'REFUND' | 'TOP_UP' | 'RESET'>;
}

export const reserve = async (tx: TransactionClient, params: ReserveCreditParams) => {
  const result = await creditRepository.reserveCredit(tx, params);

  if (!result) {
    const workspace = await tx.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { remainingCredit: true },
    });
    const remaining = workspace?.remainingCredit ?? 0;
    throw new PaymentRequiredError(
      `Không đủ credit để thực hiện. Cần ${params.cost}, còn ${remaining}.`
    );
  }

  return result;
};

export const refund = async (tx: TransactionClient, params: CreditMutationParams) => {
  return creditRepository.refundCredit(tx, params);
};

export const increase = async (
  tx: TransactionClient,
  params: {
    workspaceId: string;
    userId: string | null;
    amount: number;
    action: 'TOP_UP' | 'REFUND';
    reason: string;
  }
) => creditRepository.increaseCredit(tx, params);

export default {
  reserve,
  refund,
  increase,
};
