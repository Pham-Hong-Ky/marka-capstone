import env from '../config/env.js';
import { escapeHtml } from './email.utils.js';
import type { TesterInvitePlatform } from './testerInviteEmail.js';

export interface TesterRequestEmailInput {
  userName: string;
  userEmail: string;
  platform: TesterInvitePlatform;
  profileLink: string;
}

const PLATFORM_LABEL: Record<TesterInvitePlatform, string> = {
  FACEBOOK: 'Facebook',
  THREADS: 'Threads',
};

export const getTesterPlatformLabel = (platform: TesterInvitePlatform): string =>
  PLATFORM_LABEL[platform];

export const buildTesterRequestEmail = ({
  userName,
  userEmail,
  platform,
  profileLink,
}: TesterRequestEmailInput): { subject: string; html: string } => {
  const label = PLATFORM_LABEL[platform];
  const adminUrl = new URL('/admin/users', env.CLIENT_URL).toString();
  const subject = `[Marka] Yêu cầu thêm ${label} Tester từ ${userName}`;

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="color: #4338ca;">Yêu cầu thêm ${label} Tester</h2>
    <p><strong>${escapeHtml(userName)}</strong> (${escapeHtml(userEmail)}) muốn kết nối kênh ${label} và đề nghị được thêm làm Tester.</p>
    <p>Tài khoản ${label}: <a href="${escapeHtml(profileLink)}">${escapeHtml(profileLink)}</a></p>
    <p>Các bước xử lý: thêm tài khoản này vào App Dashboard → App Roles, sau đó vào trang quản lý người dùng và gửi email mời tester.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(adminUrl)}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Mở trang quản lý người dùng
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">Marka — Nền tảng AI Content đa kênh cho marketer Việt Nam.</p>
  </div>`;

  return { subject, html };
};

export default { buildTesterRequestEmail };
