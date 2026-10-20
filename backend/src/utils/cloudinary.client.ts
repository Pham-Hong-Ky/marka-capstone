import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';
import { BadRequestError } from './errors/index.js';
import logger from './logger.js';

export class CloudinaryClient {
  readonly isCloudinaryConfigured: boolean;

  constructor() {
    this.isCloudinaryConfigured = Boolean(
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    );

    if (this.isCloudinaryConfigured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  uploadImageBuffer(buffer: Buffer, folder: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isCloudinaryConfigured) {
        reject(new BadRequestError('Chưa cấu hình Cloudinary để tải ảnh lên'));
        return;
      }

      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            logger.error(`Upload Cloudinary thất bại: ${error?.message ?? 'không có kết quả'}`);
            reject(new BadRequestError('Tải ảnh lên thất bại, vui lòng thử lại'));
            return;
          }
          resolve(result.secure_url);
        }
      );

      stream.end(buffer);
    });
  }
}

export const cloudinaryClient = new CloudinaryClient();

export default cloudinaryClient;
