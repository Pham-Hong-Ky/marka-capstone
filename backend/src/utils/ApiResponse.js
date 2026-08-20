export class ApiResponse {
  static success(res, { statusCode = 200, message = 'Thành công', data = null, meta = null } = {}) {
    const payload = { status: 'success', message };
    if (data !== null && data !== undefined) payload.data = data;
    if (meta) payload.meta = meta;
    return res.status(statusCode).json(payload);
  }

  static error(res, { statusCode = 500, message = 'Đã có lỗi xảy ra', errors = null } = {}) {
    const payload = { status: `${statusCode}`.startsWith('4') ? 'fail' : 'error', message };
    if (errors) payload.errors = errors;
    return res.status(statusCode).json(payload);
  }
}

export default ApiResponse;
