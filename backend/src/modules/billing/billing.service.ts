import type { Order } from '@prisma/client';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { withTransaction } from '../../utils/transaction.js';
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../utils/errors/index.js';
import auditService from '../audit/audit.service.js';
import billingRepository from './billing.repository.js';
import { payosClient } from './billing.payos.js';
import type { ListTransactionsQuery } from './billing.validation.js';

const ORDER_LINK_TTL_MS = 30 * 60 * 1000;

const toOrderResponse = (order: Order) => ({
  id: order.id,
  orderCode: order.orderCode,
  amount: order.amount,
  creditAmount: order.creditAmount,
  packageId: order.packageId,
  status: order.status,
  checkoutUrl: order.checkoutUrl,
  expiresAt: order.expiresAt,
  createdAt: order.createdAt,
});

const generateOrderCode = (): string =>
  `${Date.now()}${Math.floor(Math.random() * 900) + 100}`;

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

const buildBillingUrls = (orderCode: string, orderId: string) => {
  const baseUrl = env.CLIENT_URL.replace(/\/$/, '');
  return {
    returnUrl: `${baseUrl}/billing?orderCode=${orderCode}&orderId=${orderId}`,
    cancelUrl: `${baseUrl}/billing?orderCode=${orderCode}&orderId=${orderId}`,
  };
};

export const getBilling = async (workspaceId: string) => {
  const [workspace, packages] = await Promise.all([
    billingRepository.findWorkspaceCredit(workspaceId),
    billingRepository.listActiveCreditPackages(),
  ]);

  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  return {
    remainingCredit: workspace.remainingCredit,
    packages,
  };
};

export const listTransactions = async (workspaceId: string, query: ListTransactionsQuery) => {
  const skip = (query.page - 1) * query.limit;
  const [transactions, total] = await Promise.all([
    billingRepository.listCreditTransactions(workspaceId, skip, query.limit),
    billingRepository.countCreditTransactions(workspaceId),
  ]);

  return {
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      action: transaction.action,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      reason: transaction.reason,
      createdAt: transaction.createdAt,
      createdBy: transaction.createdBy,
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const createOrder = async (workspaceId: string, userId: string, packageId: string) => {
  const [workspace, creditPackage] = await Promise.all([
    billingRepository.findWorkspaceCredit(workspaceId),
    billingRepository.findCreditPackageById(packageId),
  ]);

  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  if (!creditPackage) {
    throw new NotFoundError('Gói nạp không tồn tại hoặc đã ngừng bán');
  }

  if (!payosClient.isConfigured()) {
    throw new ServiceUnavailableError('Cổng thanh toán chưa được cấu hình');
  }

  let order: Order | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      order = await billingRepository.createOrder({
        workspaceId,
        orderCode: generateOrderCode(),
        packageId: creditPackage.id,
        amount: creditPackage.price,
        creditAmount: creditPackage.creditAmount,
        status: 'PENDING',
        createdById: userId,
      });
      break;
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  if (!order) {
    throw new ConflictError('Không thể tạo mã đơn hàng, vui lòng thử lại');
  }

  let payment;
  try {
    payment = await payosClient.createPaymentLink({
      orderCode: Number(order.orderCode),
      amount: order.amount,
      description: `MARKA ${order.orderCode}`,
      ...buildBillingUrls(order.orderCode, order.id),
      expiredAt: Math.floor((Date.now() + ORDER_LINK_TTL_MS) / 1000),
    });
  } catch (error) {
    await billingRepository.updateOrder(order.id, { status: 'CANCELLED' });
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Tạo link thanh toán PayOS thất bại cho order ${order.orderCode}: ${message}`);
    throw new BadGatewayError('Không thể tạo link thanh toán. Vui lòng thử lại.');
  }

  const updated = await billingRepository.updateOrder(order.id, {
    paymentLinkId: payment.paymentLinkId,
    checkoutUrl: payment.checkoutUrl,
    expiresAt: payment.expiredAt
      ? new Date(payment.expiredAt * 1000)
      : new Date(Date.now() + ORDER_LINK_TTL_MS),
  });

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'BILLING_ORDER_CREATED',
    targetType: 'Order',
    targetId: order.id,
    metadata: {
      packageId: creditPackage.id,
      amount: order.amount,
      creditAmount: order.creditAmount,
      orderCode: order.orderCode,
    },
  });

  return { order: toOrderResponse(updated) };
};

export const finalizePaidOrder = async (order: Order, payosTransId: string, amount: number) => {
  if (amount !== order.amount) {
    await billingRepository.cancelPendingOrder(order.id);
    logger.warn(
      `Webhook lệch amount cho order ${order.orderCode}: nhận ${amount}, cần ${order.amount}`
    );
    return { processed: false as const };
  }

  const result = await withTransaction(async (tx) => {
    const claim = await billingRepository.claimPaidOrder(tx, order.id, payosTransId, new Date());
    if (claim.count === 0) {
      return { processed: false as const };
    }

    const currentOrder = await billingRepository.findOrderById(tx, order.id);
    if (!currentOrder) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    const workspace = await billingRepository.findWorkspaceCreditForUpdate(
      tx,
      currentOrder.workspaceId
    );
    if (!workspace) {
      throw new NotFoundError('Workspace không tồn tại');
    }

    const creditAmount = currentOrder.creditAmount ?? 0;
    const creditPackage = currentOrder.packageId
      ? await billingRepository.findCreditPackageByIdInTransaction(tx, currentOrder.packageId)
      : null;

    const updated = await billingRepository.incrementWorkspaceCredit(
      tx,
      workspace.id,
      creditAmount
    );

    const balanceAfter = updated.remainingCredit;
    const balanceBefore = balanceAfter - creditAmount;

    await billingRepository.createCreditTransaction(tx, {
      workspaceId: workspace.id,
      type: 'INFLOW',
      action: 'TOP_UP',
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      reason: creditPackage ? `Nạp ${creditPackage.name}` : `Nạp ${creditAmount} credit`,
      createdById: currentOrder.createdById,
    });

    return {
      processed: true as const,
      workspaceId: workspace.id,
      creditAmount,
    };
  });

  if (result.processed) {
    await auditService.recordAuditLog({
      workspaceId: order.workspaceId,
      actorId: order.createdById,
      action: 'BILLING_CREDIT_TOP_UP',
      targetType: 'Order',
      targetId: order.id,
      metadata: {
        orderCode: order.orderCode,
        packageId: order.packageId,
        amount: order.amount,
        creditAmount: order.creditAmount,
      },
    });
  }

  return result;
};

export const getOrder = async (workspaceId: string, orderId: string) => {
  const order = await billingRepository.findOrderInWorkspace(orderId, workspaceId);
  if (!order) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }

  if (order.status === 'PENDING' && order.paymentLinkId && payosClient.isConfigured()) {
    try {
      const payment = await payosClient.getPaymentLink(Number(order.orderCode));

      if (payment.status === 'PAID') {
        const reference = payment.transactions.at(-1)?.reference ?? payment.id;
        await finalizePaidOrder(order, reference, payment.amountPaid || payment.amount);
      } else if (payment.status === 'CANCELLED' || payment.status === 'EXPIRED') {
        await billingRepository.cancelPendingOrder(order.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Đối soát PayOS thất bại cho order ${order.orderCode}: ${message}`);
    }
  }

  const freshOrder = await billingRepository.findOrderInWorkspace(orderId, workspaceId);
  if (!freshOrder) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }

  return { order: toOrderResponse(freshOrder) };
};

export const cancelOrder = async (workspaceId: string, orderId: string, userId: string) => {
  const order = await billingRepository.findOrderInWorkspace(orderId, workspaceId);
  if (!order) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }

  if (order.createdById !== userId) {
    throw new ForbiddenError('Chỉ người tạo đơn mới được huỷ đơn');
  }

  if (order.status !== 'PENDING') {
    throw new ConflictError('Chỉ có thể huỷ đơn đang chờ thanh toán');
  }

  if (order.paymentLinkId) {
    if (!payosClient.isConfigured()) {
      throw new ServiceUnavailableError('Cổng thanh toán chưa được cấu hình');
    }

    try {
      await payosClient.cancelPaymentLink(Number(order.orderCode), 'Người dùng huỷ đơn');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Huỷ link PayOS thất bại cho order ${order.orderCode}: ${message}`);
      throw new BadGatewayError('Không thể huỷ link thanh toán. Vui lòng thử lại.');
    }
  }

  const cancelled = await billingRepository.cancelPendingOrder(order.id);
  if (cancelled.count === 0) {
    throw new ConflictError('Đơn hàng đã được xử lý');
  }

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'BILLING_ORDER_CANCELLED',
    targetType: 'Order',
    targetId: order.id,
    metadata: { orderCode: order.orderCode },
  });

  return { success: true as const };
};

export const handlePayosWebhook = async (body: unknown) => {
  if (!payosClient.isConfigured()) {
    throw new ServiceUnavailableError('Cổng thanh toán chưa được cấu hình');
  }

  let data;
  try {
    data = await payosClient.verifyWebhook(body as Parameters<typeof payosClient.verifyWebhook>[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Webhook PayOS sai chữ ký: ${message}`);
    throw new BadRequestError('Chữ ký webhook không hợp lệ');
  }

  if (data.code && data.code !== '00') {
    logger.warn(`Webhook PayOS bỏ qua vì mã ${data.code}: ${data.desc}`);
    return { success: true as const };
  }

  const order = await billingRepository.findOrderByCode(String(data.orderCode));
  if (!order) {
    logger.warn(`Webhook PayOS không tìm thấy order ${data.orderCode}`);
    return { success: true as const };
  }

  if (order.status !== 'PENDING') {
    return { success: true as const };
  }

  if (data.amount !== order.amount) {
    await billingRepository.cancelPendingOrder(order.id);
    logger.warn(
      `Webhook PayOS lệch amount cho order ${order.orderCode}: nhận ${data.amount}, cần ${order.amount}`
    );
    return { success: true as const };
  }

  await finalizePaidOrder(order, data.reference || data.paymentLinkId, data.amount);

  return { success: true as const };
};

export default {
  getBilling,
  listTransactions,
  createOrder,
  getOrder,
  cancelOrder,
  handlePayosWebhook,
  finalizePaidOrder,
};
