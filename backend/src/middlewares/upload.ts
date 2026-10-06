import multer from 'multer';
import type { RequestHandler } from 'express';
import { BadRequestError } from '../utils/errors/index.js';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      cb(new BadRequestError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'));
      return;
    }
    cb(null, true);
  },
}).single('logo');

export const uploadWorkspaceLogo: RequestHandler = (req, res, next) => {
  logoUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh logo vượt quá 2MB' : 'Tải ảnh lên không hợp lệ';
      return next(new BadRequestError(message));
    }
    if (error) return next(error);
    next();
  });
};

export default uploadWorkspaceLogo;
