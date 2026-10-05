import { Request, Response, NextFunction } from 'express';

// Bắt buộc HTTPS ở production: chuyển hướng mọi request HTTP còn sót sang HTTPS (301).
// Cần bật `trust proxy` để `req.secure` / `x-forwarded-proto` đọc đúng khi chạy sau reverse proxy.
export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isHttps) {
    return next();
  }

  return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
};

export default enforceHttps;
