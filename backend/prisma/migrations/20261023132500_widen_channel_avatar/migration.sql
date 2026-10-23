-- URL ảnh Page do Facebook CDN trả về có thể dài hơn 255 ký tự.
ALTER TABLE "channel_connections" ALTER COLUMN "avatar" TYPE VARCHAR(2048);
