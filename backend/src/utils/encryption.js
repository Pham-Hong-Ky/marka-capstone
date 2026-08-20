import crypto from 'crypto';
import env from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const getKey = () => crypto.createHash('sha256').update(env.AES_SECRET_KEY).digest();

export const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (cipherText) => {
  if (!cipherText) return cipherText;
  const [ivHex, tagHex, dataHex] = cipherText.split(':');
  if (!ivHex || !tagHex || !dataHex) return cipherText;

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};

export default { encrypt, decrypt };
