import {
  PayOS,
  type CreatePaymentLinkRequest,
  type CreatePaymentLinkResponse,
  type PaymentLink,
  type Webhook,
  type WebhookData,
} from '@payos/node';
import env from '../../config/env.js';
import { ServiceUnavailableError } from '../../utils/errors/index.js';

class BillingPayOSClient {
  private client: PayOS | null = null;

  isConfigured(): boolean {
    return Boolean(env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY);
  }

  private getClient(): PayOS {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableError('Cổng thanh toán chưa được cấu hình');
    }

    if (!this.client) {
      this.client = new PayOS({
        clientId: env.PAYOS_CLIENT_ID,
        apiKey: env.PAYOS_API_KEY,
        checksumKey: env.PAYOS_CHECKSUM_KEY,
      });
    }

    return this.client;
  }

  createPaymentLink(input: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
    return this.getClient().paymentRequests.create(input);
  }

  getPaymentLink(orderCode: number): Promise<PaymentLink> {
    return this.getClient().paymentRequests.get(orderCode);
  }

  cancelPaymentLink(orderCode: number, reason: string): Promise<PaymentLink> {
    return this.getClient().paymentRequests.cancel(orderCode, reason);
  }

  verifyWebhook(body: Webhook): Promise<WebhookData> {
    return this.getClient().webhooks.verify(body);
  }
}

export const payosClient = new BillingPayOSClient();

export default payosClient;
