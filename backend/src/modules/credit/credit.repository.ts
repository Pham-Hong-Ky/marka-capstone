import type { CreditActionType, Prisma } from '@prisma/client';

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

export const reserveCredit = async (tx: TransactionClient, params: ReserveCreditParams) => {
  const { count } = await tx.workspace.updateMany({
    where: { id: params.workspaceId, remainingCredit: { gte: params.cost } },
    data: { remainingCredit: { decrement: params.cost } },
  });

  if (count === 0) {
    return null;
  }

  const workspace = await tx.workspace.findUniqueOrThrow({
    where: { id: params.workspaceId },
    select: { remainingCredit: true },
  });

  const balanceAfter = workspace.remainingCredit;
  const balanceBefore = balanceAfter + params.cost;

  await tx.creditTransaction.create({
    data: {
      workspaceId: params.workspaceId,
      type: 'OUTFLOW',
      action: params.action,
      amount: params.cost,
      balanceBefore,
      balanceAfter,
      reason: params.reason,
      createdById: params.userId,
    },
  });

  return { balanceBefore, balanceAfter };
};

export const refundCredit = async (tx: TransactionClient, params: CreditMutationParams) => {
  const workspace = await tx.workspace.update({
    where: { id: params.workspaceId },
    data: { remainingCredit: { increment: params.cost } },
    select: { remainingCredit: true },
  });

  const balanceAfter = workspace.remainingCredit;
  const balanceBefore = balanceAfter - params.cost;

  await tx.creditTransaction.create({
    data: {
      workspaceId: params.workspaceId,
      type: 'INFLOW',
      action: 'REFUND',
      amount: params.cost,
      balanceBefore,
      balanceAfter,
      reason: params.reason,
      createdById: params.userId,
    },
  });

  return { balanceBefore, balanceAfter };
};

export default {
  reserveCredit,
  refundCredit,
};
