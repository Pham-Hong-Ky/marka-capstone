import { Resend } from 'resend';
import env from '../config/env.js';
import logger from './logger.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html }: SendEmailInput): Promise<boolean> => {
  if (env.NODE_ENV === 'test') {
    return true;
  }

  if (!resend) {
    logger.warn(`RESEND_API_KEY chưa cấu hình — bỏ qua gửi email tới ${to}`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error(`Gửi email tới ${to} thất bại: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Gửi email tới ${to} thất bại: ${message}`);
    return false;
  }
};

export default { sendEmail };
