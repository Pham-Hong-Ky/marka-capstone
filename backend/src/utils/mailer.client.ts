import { getErrorMessage } from './errorMessage.js';
import { Resend } from 'resend';
import env from '../config/env.js';
import logger from './logger.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export class MailerClient {
  private readonly resend: Resend | null;

  constructor(apiKey: string = env.RESEND_API_KEY) {
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
    if (env.NODE_ENV === 'test') {
      return true;
    }

    if (!this.resend) {
      logger.warn(`RESEND_API_KEY chưa cấu hình — bỏ qua gửi email tới ${to}`);
      return false;
    }

    try {
      const { error } = await this.resend.emails.send({
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
      const message = getErrorMessage(error);
      logger.error(`Gửi email tới ${to} thất bại: ${message}`);
      return false;
    }
  }
}

export const mailerClient = new MailerClient();

export default mailerClient;
