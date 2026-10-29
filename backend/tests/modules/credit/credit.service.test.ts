import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prisma from '../../../src/config/db.js';
import { withTransaction } from '../../../src/utils/transaction.js';
import { PaymentRequiredError } from '../../../src/utils/errors/index.js';
import creditService from '../../../src/modules/credit/credit.service.js';

const stamp = Date.now();

describe('Credit service', () => {
  let workspaceId = '';
  let userId = '';

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `test_credit_${stamp}@marka.vn`, name: 'Credit Test' },
    });
    userId = user.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: `Credit Workspace ${stamp}`,
        remainingCredit: 25,
        monthlyQuota: 100,
        members: { create: { userId, role: 'OWNER' } },
      },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('trừ credit và ghi giao dịch OUTFLOW đúng số dư', async () => {
    const result = await withTransaction((tx) =>
      creditService.reserve(tx, {
        workspaceId,
        userId,
        cost: 10,
        action: 'GEN_TEXT',
        reason: 'Tạo nội dung AI',
      })
    );

    expect(result).toMatchObject({ balanceBefore: 25, balanceAfter: 15 });

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(15);

    const transaction = await prisma.creditTransaction.findFirstOrThrow({
      where: { workspaceId, action: 'GEN_TEXT' },
      orderBy: { createdAt: 'desc' },
    });
    expect(transaction).toMatchObject({
      type: 'OUTFLOW',
      amount: 10,
      balanceBefore: 25,
      balanceAfter: 15,
    });
  });

  it('không đủ credit thì ném 402 và không đổi số dư', async () => {
    await expect(
      withTransaction((tx) =>
        creditService.reserve(tx, {
          workspaceId,
          userId,
          cost: 20,
          action: 'GEN_IMAGE',
          reason: 'Tạo ảnh AI',
        })
      )
    ).rejects.toBeInstanceOf(PaymentRequiredError);

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    expect(workspace.remainingCredit).toBe(15);
  });

  it('hoàn credit và ghi giao dịch INFLOW/REFUND', async () => {
    const result = await withTransaction((tx) =>
      creditService.refund(tx, {
        workspaceId,
        userId,
        cost: 10,
        reason: 'Hoàn credit do tạo nội dung thất bại',
      })
    );

    expect(result).toMatchObject({ balanceBefore: 15, balanceAfter: 25 });

    const transaction = await prisma.creditTransaction.findFirstOrThrow({
      where: { workspaceId, action: 'REFUND' },
      orderBy: { createdAt: 'desc' },
    });
    expect(transaction).toMatchObject({
      type: 'INFLOW',
      amount: 10,
      balanceBefore: 15,
      balanceAfter: 25,
    });
  });
});
