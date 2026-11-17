import { Request, Response } from 'express';
import type { WorkspaceRole } from '@prisma/client';
import { getWorkspaceId } from '../../utils/request.js';
import ApiResponse from '../../utils/ApiResponse.js';
import catchAsync from '../../utils/catchAsync.js';
import postVersionService from './post-version.service.js';

const getVersionParams = (req: Request) => ({
  postId: req.params.postId as string,
  version: Number(req.params.version),
});

export const listVersions = catchAsync(async (req: Request, res: Response) => {
  const versions = await postVersionService.listVersions(
    getWorkspaceId(req),
    req.params.postId as string
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy lịch sử phiên bản thành công',
    data: { versions },
  });
});

export const getVersion = catchAsync(async (req: Request, res: Response) => {
  const { postId, version } = getVersionParams(req);
  const found = await postVersionService.getVersion(getWorkspaceId(req), postId, version);

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Lấy chi tiết phiên bản thành công',
    data: found,
  });
});

export const restoreVersion = catchAsync(async (req: Request, res: Response) => {
  const { postId, version } = getVersionParams(req);
  const post = await postVersionService.restoreVersion(
    getWorkspaceId(req),
    req.user!.id,
    req.workspaceRole as WorkspaceRole,
    postId,
    version
  );

  return ApiResponse.success(res, {
    statusCode: 200,
    message: 'Khôi phục phiên bản thành công',
    data: post,
  });
});

export default {
  listVersions,
  getVersion,
  restoreVersion,
};
