import { getWorkspaceId } from '../../utils/request.js';
import { Request, Response } from 'express';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';
import billingService from './billing.service.js';
import type { CreateOrderBody, ListTransactionsQuery } from './billing.validation.js';

export const getBilling = catchAsync(async (req: Request, res: Response) => {
  const data = await billingService.getBilling(getWorkspaceId(req));

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy thông tin gói và credit thành công',
    data,
  });
});

export const listTransactions = catchAsync(async (req: Request, res: Response) => {
  const data = await billingService.listTransactions(
    getWorkspaceId(req),
    req.query as unknown as ListTransactionsQuery
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy lịch sử credit thành công',
    data: { transactions: data.transactions },
    meta: data.meta,
  });
});

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const { packageId } = req.body as CreateOrderBody;
  const data = await billingService.createOrder(
    getWorkspaceId(req),
    req.user!.id,
    packageId
  );

  return ApiResponse.success(res, {
    statusCode: 201,
    message: 'Tạo đơn thanh toán thành công',
    data,
  });
});

export const getOrder = catchAsync(async (req: Request, res: Response) => {
  const data = await billingService.getOrder(
    getWorkspaceId(req),
    req.params.orderId as string
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy trạng thái đơn hàng thành công',
    data,
  });
});

export const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  const data = await billingService.cancelOrder(
    getWorkspaceId(req),
    req.params.orderId as string,
    req.user!.id
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Huỷ đơn hàng thành công',
    data,
  });
});

export const handlePayosWebhook = catchAsync(async (req: Request, res: Response) => {
  const data = await billingService.handlePayosWebhook(req.body);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'OK',
    data,
  });
});

export default {
  getBilling,
  listTransactions,
  createOrder,
  getOrder,
  cancelOrder,
  handlePayosWebhook,
};
