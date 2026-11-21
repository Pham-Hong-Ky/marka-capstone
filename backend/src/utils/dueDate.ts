import { BadRequestError } from './errors/index.js';
import { addDays } from './date.js';

const MAX_DUE_AHEAD_DAYS = 365;

export const assertDueAtValid = (dueAt?: Date | null, currentDueAt?: Date | null) => {
  if (!dueAt) return;

  const now = new Date();
  if (dueAt.getTime() < now.getTime()) {
    // Cho phép giữ nguyên hạn cũ đã qua khi chỉ sửa các trường khác.
    if (currentDueAt && dueAt.getTime() === currentDueAt.getTime()) return;
    throw new BadRequestError('Hạn chót không được ở quá khứ');
  }
  if (dueAt.getTime() > addDays(now, MAX_DUE_AHEAD_DAYS).getTime()) {
    throw new BadRequestError('Hạn chót tối đa 1 năm kể từ hiện tại');
  }
};

export default assertDueAtValid;
