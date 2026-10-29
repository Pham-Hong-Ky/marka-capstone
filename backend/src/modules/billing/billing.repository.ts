import type { Prisma } from '@prisma/client';
import prisma from '../../config/db.js';

type TransactionClient = Prisma.TransactionClient;

export const findWorkspaceCredit = async (workspaceId: string) => {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, remainingCredit: true },
  });
};

export const findWorkspaceCreditForUpdate = async (
  tx: TransactionClient,
  workspaceId: string
) => {
  return tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, remainingCredit: true },
  });
};

export const listActiveCreditPackages = async () => {
  return prisma.creditPackage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      creditAmount: true,
      price: true,
      sortOrder: true,
    },
  });
};

export const findCreditPackageById = async (packageId: string) => {
  return prisma.creditPackage.findFirst({
    where: { id: packageId, isActive: true },
  });
};

export const findCreditPackageByIdInTransaction = async (
  tx: TransactionClient,
  packageId: string
) => {
  return tx.creditPackage.findFirst({
    where: { id: packageId, isActive: true },
    select: { id: true, name: true, creditAmount: true, price: true },
  });
};

export const listCreditTransactions = async (workspaceId: string, skip: number, take: number) => {
  return prisma.creditTransaction.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: {
      createdBy: { select: { id: true, name: true } },
    },
  });
};

export const countCreditTransactions = async (workspaceId: string) => {
  return prisma.creditTransaction.count({ where: { workspaceId } });
};

export const createOrder = async (data: Prisma.OrderUncheckedCreateInput) => {
  return prisma.order.create({ data });
};

export const findOrderInWorkspace = async (orderId: string, workspaceId: string) => {
  return prisma.order.findFirst({
    where: { id: orderId, workspaceId },
  });
};

export const findOrderByCode = async (orderCode: string) => {
  return prisma.order.findUnique({ where: { orderCode } });
};

export const findOrderById = async (tx: TransactionClient, orderId: string) => {
  return tx.order.findUnique({ where: { id: orderId } });
};

export const updateOrder = async (orderId: string, data: Prisma.OrderUpdateInput) => {
  return prisma.order.update({ where: { id: orderId }, data });
};

export const cancelPendingOrder = async (orderId: string) => {
  return prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
};

export const claimPaidOrder = async (
  tx: TransactionClient,
  orderId: string,
  payosTransId: string,
  paidAt: Date
) => {
  return tx.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'PAID', payosTransId, paidAt },
  });
};

export default {
  findWorkspaceCredit,
  findWorkspaceCreditForUpdate,
  listActiveCreditPackages,
  findCreditPackageById,
  findCreditPackageByIdInTransaction,
  listCreditTransactions,
  countCreditTransactions,
  createOrder,
  findOrderInWorkspace,
  findOrderByCode,
  findOrderById,
  updateOrder,
  cancelPendingOrder,
  claimPaidOrder,
};
