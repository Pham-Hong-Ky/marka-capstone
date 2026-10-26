import multer from 'multer';
import type { RequestHandler } from 'express';
import { BadRequestError } from '../utils/errors/index.js';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ImageUploadOptions {
  field: string;
  maxBytes: number;
  tooLargeMessage: string;
}

const createImageUpload = ({ field, maxBytes, tooLargeMessage }: ImageUploadOptions): RequestHandler => {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
        cb(new BadRequestError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'));
        return;
      }
      cb(null, true);
    },
  }).single(field);

  return (req, res, next) => {
    uploader(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE' ? tooLargeMessage : 'Tải ảnh lên không hợp lệ';
        return next(new BadRequestError(message));
      }
      if (error) return next(error);
      next();
    });
  };
};

export const uploadPostMedia = createImageUpload({
  field: 'file',
  maxBytes: 10 * 1024 * 1024,
  tooLargeMessage: 'Ảnh vượt quá 10MB',
});

export const uploadAvatar = createImageUpload({
  field: 'file',
  maxBytes: 2 * 1024 * 1024,
  tooLargeMessage: 'Ảnh đại diện vượt quá 2MB',
});

export default uploadPostMedia;
