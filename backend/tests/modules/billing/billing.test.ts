import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app.js';
import prisma from '../../../src/config/db.js';
import { payosClient } from '../../../src/modules/billing/billing.payos.js';

const password = 'password123';

const createPaymentResponse = (input: {
  orderCode: number;
  amount: number;
  description: string;
  expiredAt?: number;
}) => ({
  bin: '970422',
  accountNumber: '123456789',
  accountName: 'MARKA',
  amount: input.amount,
  description: input.description,
  orderCode: input.orderCode,
  currency: 'VND',
  paymentLinkId: `link-${input.orderCode}`,
  status: 'PENDING' as const,
  expiredAt: input.expiredAt,
  checkoutUrl: `https://pay.payos.vn/${input.orderCode}`,
  qrCode: 'qr-code',
});

const emptyPaymentLink = () => ({
  id: 'link',
  orderCode: 0,
  amount: 0,
  amountPaid: 0,
  amountRemaining: 0,
  status: 'CANCELLED' as const,
  createdAt: new Date().toISOString(),
  transactions: [],
  cancellationReason: null,
  canceledAt: null,
});

const paidPaymentLink = (orderCode: number, amount = 25_000) => ({
  id: `link-${orderCode}`,
  orderCode,
  amount,
  amountPaid: amount,
  amountRemaining: 0,
  status: 'PAID' as const,
  createdAt: new Date().toISOString(),
  transactions: [
    {
      reference: `ref-${orderCode}`,
      amount,
      accountNumber: '123',
      description: 'MARKA',
      transactionDateTime: new Date().toISOString(),
      virtualAccountName: null,
      virtualAccountNumber: null,
      counterAccountBankId: null,
      counterAccountBankName: null,
      counterAccountName: null,
      counterAccountNumber: null,
    },
  ],
  cancellationReason: null,
  canceledAt: null,
});

describe('Billing - nạp credit qua PayOS (UC31, UC40, UC41)', () => {
  const stamp = Date.now();
  const owner = { email: `test_billing_owner_${stamp}@marka.vn`, name: 'Owner Billing' };
  const creator = { email: `test_billing_creator_${stamp}@marka.vn`, name: 'Creator Billing' };
  const outsider = { email: `test_billing_outsider_${stamp}@marka.vn`, name: 'Outsider Billing' };

  let ownerToken = '';
  let creatorToken = '';
  let outsiderToken = '';
  let creatorId = '';
  let wsId = '';
  let outsiderWsId = '';
  let packageId = '';
  let packagePrice = 0;
  let packageCredit = 0;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const billingUrl = () => `/api/v1/workspaces/${wsId}/billing`;

  const resetWorkspace = async () => {
    await prisma.workspace.update({
      where: { id: wsId },
      data: { remainingCredit: 100 },
    });
  };

  const createOrder = async (token = creatorToken, id = packageId) => {
    return request(app)
      .post(`${billingUrl()}/orders`)
      .set(auth(token))
      .send({ packageId: id });
  };

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });

    const testPackage = await prisma.creditPackage.create({
      data: {
        name: `Gói test ${stamp}`,
        description: 'Gói dùng cho test',
        creditAmount: 500,
        price: 25_000,
        sortOrder: 99,
        isActive: true,
      },
    });
    packageId = testPackage.id;
    packagePrice = testPackage.price;
    packageCredit = testPackage.creditAmount;

    const ownerRes = await request(app).post('/api/v1/auth/register').send({ ...owner, password });
    ownerToken = ownerRes.body.data.accessToken;
    wsId = ownerRes.body.data.user.workspaces[0].id;

    const creatorRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...creator, password });
    creatorId = creatorRes.body.data.user.id;
    creatorToken = creatorRes.body.data.accessToken;
    await prisma.workspaceMember.create({
      data: { workspaceId: wsId, userId: creatorId, role: 'CONTENT_CREATOR' },
    });

    const outsiderRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...outsider, password });
    outsiderToken = outsiderRes.body.data.accessToken;
    outsiderWsId = outsiderRes.body.data.user.workspaces[0].id;
  });

  beforeEach(async () => {
    await prisma.order.deleteMany({ where: { workspaceId: wsId } });
    await prisma.creditTransaction.deleteMany({ where: { workspaceId: wsId } });
    await resetWorkspace();

    vi.spyOn(payosClient, 'isConfigured').mockReturnValue(true);
    vi.spyOn(payosClient, 'createPaymentLink').mockImplementation(async (input) =>
      createPaymentResponse({
        orderCode: input.orderCode,
        amount: input.amount,
        description: input.description,
        expiredAt: input.expiredAt,
      })
    );
    vi.spyOn(payosClient, 'cancelPaymentLink').mockResolvedValue(emptyPaymentLink());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({
      where: { id: { in: [wsId, outsiderWsId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [owner.email, creator.email, outsider.email] } },
    });
    if (packageId) {
      await prisma.creditPackage.deleteMany({ where: { id: packageId } });
    }
  });

  it('UC40 - thành viên xem số dư và danh sách gói nạp', async () => {
    const res = await request(app).get(billingUrl()).set(auth(creatorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.remainingCredit).toBe(100);
    expect(res.body.data.packages.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.packages.find((item: { id: string }) => item.id === packageId)
    ).toMatchObject({
      id: packageId,
      creditAmount: packageCredit,
      price: packagePrice,
    });
  });

  it('UC31 - mọi thành viên đều tạo được đơn nạp, không chỉ Owner', async () => {
    const res = await createOrder(creatorToken);

    expect(res.status).toBe(201);
    expect(res.body.data.order).toMatchObject({
      amount: packagePrice,
      creditAmount: packageCredit,
      packageId,
      status: 'PENDING',
    });
    expect(res.body.data.order.checkoutUrl).toContain('pay.payos.vn');

    const saved = await prisma.order.findUnique({ where: { id: res.body.data.order.id } });
    expect(saved?.createdById).toBe(creatorId);
  });

  it('UC31 - người ngoài workspace không tạo được đơn', async () => {
    const res = await request(app)
      .post(`${billingUrl()}/orders`)
      .set(auth(outsiderToken))
      .send({ packageId });

    expect(res.status).toBe(403);
  });

  it('UC31 - gói nạp không tồn tại trả 404', async () => {
    const res = await createOrder(creatorToken, '00000000-0000-4000-8000-000000000099');
    expect(res.status).toBe(404);
  });

  it('UC31 - thiếu cấu hình PayOS trả 503', async () => {
    vi.spyOn(payosClient, 'isConfigured').mockReturnValue(false);

    const res = await createOrder(creatorToken);
    expect(res.status).toBe(503);
  });

  it('Webhook hợp lệ cộng credit, gửi lặp không cộng trùng', async () => {
    const orderRes = await createOrder(creatorToken);
    const order = orderRes.body.data.order;

    vi.spyOn(payosClient, 'verifyWebhook').mockResolvedValue({
      orderCode: Number(order.orderCode),
      amount: packagePrice,
      description: 'MARKA',
      accountNumber: '123',
      reference: 'ref-webhook-1',
      transactionDateTime: new Date().toISOString(),
      currency: 'VND',
      paymentLinkId: 'link-1',
      code: '00',
      desc: 'success',
    });

    const webhook = () =>
      request(app).post('/api/v1/webhooks/payos').send({
        code: '00',
        desc: 'success',
        success: true,
        data: { orderCode: Number(order.orderCode) },
        signature: 'signature',
      });

    const first = await webhook();
    expect(first.status).toBe(200);

    const paidOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(paidOrder?.status).toBe('PAID');
    expect(paidOrder?.payosTransId).toBe('ref-webhook-1');

    const workspace = await prisma.workspace.findUnique({ where: { id: wsId } });
    expect(workspace?.remainingCredit).toBe(100 + packageCredit);

    const ledger = await prisma.creditTransaction.findMany({
      where: { workspaceId: wsId, action: 'TOP_UP' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amount: packageCredit,
      balanceBefore: 100,
      balanceAfter: 100 + packageCredit,
    });

    const second = await webhook();
    expect(second.status).toBe(200);

    const afterSecond = await prisma.workspace.findUnique({ where: { id: wsId } });
    expect(afterSecond?.remainingCredit).toBe(100 + packageCredit);
    expect(
      await prisma.creditTransaction.count({ where: { workspaceId: wsId, action: 'TOP_UP' } })
    ).toBe(1);
  });

  it('Webhook sai chữ ký trả 400', async () => {
    vi.spyOn(payosClient, 'verifyWebhook').mockRejectedValue(new Error('invalid signature'));

    const res = await request(app).post('/api/v1/webhooks/payos').send({ signature: 'bad' });
    expect(res.status).toBe(400);
  });

  it('Webhook lệch amount huỷ order và không cộng credit', async () => {
    const orderRes = await createOrder(creatorToken);
    const order = orderRes.body.data.order;

    vi.spyOn(payosClient, 'verifyWebhook').mockResolvedValue({
      orderCode: Number(order.orderCode),
      amount: 1_000,
      description: 'MARKA',
      accountNumber: '123',
      reference: 'ref-wrong-amount',
      transactionDateTime: new Date().toISOString(),
      currency: 'VND',
      paymentLinkId: 'link-1',
      code: '00',
      desc: 'success',
    });

    const res = await request(app).post('/api/v1/webhooks/payos').send({ signature: 'ok' });
    expect(res.status).toBe(200);

    const saved = await prisma.order.findUnique({ where: { id: order.id } });
    expect(saved?.status).toBe('CANCELLED');

    const workspace = await prisma.workspace.findUnique({ where: { id: wsId } });
    expect(workspace?.remainingCredit).toBe(100);
    expect(await prisma.creditTransaction.count({ where: { workspaceId: wsId } })).toBe(0);
  });

  it('Webhook cho workspace đã xoá giữ order PAID để hoàn tiền, không retry', async () => {
    const orderRes = await createOrder(creatorToken);
    const order = orderRes.body.data.order;

    await prisma.workspace.update({ where: { id: wsId }, data: { deletedAt: new Date() } });
    vi.spyOn(payosClient, 'verifyWebhook').mockResolvedValue({
      orderCode: Number(order.orderCode),
      amount: packagePrice,
      description: 'MARKA',
      accountNumber: '123',
      reference: 'ref-deleted-workspace',
      transactionDateTime: new Date().toISOString(),
      currency: 'VND',
      paymentLinkId: 'link-deleted',
      code: '00',
      desc: 'success',
    });

    try {
      const res = await request(app).post('/api/v1/webhooks/payos').send({ signature: 'ok' });

      expect(res.status).toBe(200);
      const saved = await prisma.order.findUnique({ where: { id: order.id } });
      expect(saved?.status).toBe('PAID');
      expect(saved?.payosTransId).toBe('ref-deleted-workspace');
    } finally {
      await prisma.workspace.update({ where: { id: wsId }, data: { deletedAt: null } });
    }
  });

  it('Polling PayOS PAID finalize một lần', async () => {
    const orderRes = await createOrder(creatorToken);
    const order = orderRes.body.data.order;

    vi.spyOn(payosClient, 'getPaymentLink').mockResolvedValue(
      paidPaymentLink(Number(order.orderCode), packagePrice)
    );

    const first = await request(app)
      .get(`${billingUrl()}/orders/${order.id}`)
      .set(auth(creatorToken));
    expect(first.status).toBe(200);
    expect(first.body.data.order.status).toBe('PAID');

    const second = await request(app)
      .get(`${billingUrl()}/orders/${order.id}`)
      .set(auth(creatorToken));
    expect(second.status).toBe(200);

    const workspace = await prisma.workspace.findUnique({ where: { id: wsId } });
    expect(workspace?.remainingCredit).toBe(100 + packageCredit);
  });

  it('Người tạo đơn huỷ được, người khác không huỷ được', async () => {
    const orderRes = await createOrder(creatorToken);
    const order = orderRes.body.data.order;

    const forbidden = await request(app)
      .post(`${billingUrl()}/orders/${order.id}/cancel`)
      .set(auth(ownerToken));
    expect(forbidden.status).toBe(403);

    const cancelled = await request(app)
      .post(`${billingUrl()}/orders/${order.id}/cancel`)
      .set(auth(creatorToken));
    expect(cancelled.status).toBe(200);

    const saved = await prisma.order.findUnique({ where: { id: order.id } });
    expect(saved?.status).toBe('CANCELLED');
  });

  it('Không huỷ được đơn đã PAID', async () => {
    const orderRes = await createOrder(creatorToken);
    const order = orderRes.body.data.order;
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } });

    const res = await request(app)
      .post(`${billingUrl()}/orders/${order.id}/cancel`)
      .set(auth(creatorToken));
    expect(res.status).toBe(409);
  });
});
