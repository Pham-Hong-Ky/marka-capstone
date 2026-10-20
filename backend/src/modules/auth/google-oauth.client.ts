import { OAuth2Client } from 'google-auth-library';
import env from '../../config/env.js';
import { UnauthorizedError } from '../../utils/errors/index.js';

export interface GoogleProfile {
  email: string;
  name: string | undefined;
  avatar: string | null;
  googleId: string;
}

export class GoogleOAuth2Client {
  private readonly client: OAuth2Client;
  readonly clientId: string;

  constructor(clientId: string = env.GOOGLE_CLIENT_ID) {
    this.clientId = clientId;
    this.client = new OAuth2Client(clientId);
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedError('Xác thực tài khoản Google không hợp lệ');
    }

    if (!payload?.email) {
      throw new UnauthorizedError('Không thể lấy thông tin email từ Google');
    }

    // Liên kết theo email chỉ an toàn khi Google đã xác minh email đó, nếu không sẽ bị chiếm tài khoản.
    if (!payload.email_verified) {
      throw new UnauthorizedError('Email Google chưa được xác minh');
    }

    return {
      email: payload.email.toLowerCase(),
      name: payload.name,
      avatar: payload.picture ?? null,
      googleId: payload.sub,
    };
  }
}

export const googleOAuthClient = new GoogleOAuth2Client();

export default googleOAuthClient;
