import { escapeHtml } from './email.utils.js';

export type TesterInvitePlatform = 'FACEBOOK' | 'THREADS';

export interface TesterInviteEmailInput {
  actorName: string;
  userEmail: string;
  platform: TesterInvitePlatform;
}

interface TesterInviteCopy {
  label: string;
  requestsUrl: string;
  instruction: (userEmail: string) => string;
  linkLabel: string;
  followUp: string;
}

const TESTER_INVITE_COPY: Record<TesterInvitePlatform, TesterInviteCopy> = {
  FACEBOOK: {
    label: 'Facebook',
    requestsUrl: 'https://developers.facebook.com/settings/developer/requests/',
    instruction: (userEmail) =>
      `Đăng nhập Facebook bằng địa chỉ <strong>${escapeHtml(userEmail)}</strong>, mở trang lời mời rồi chấp nhận. Nếu chưa có tài khoản Meta Developer, bạn cần tạo tài khoản trước khi chấp nhận.`,
    linkLabel: 'Chấp nhận lời mời tester',
    followUp: 'Sau khi chấp nhận, quay lại Marka để kết nối kênh Facebook.',
  },
  THREADS: {
    label: 'Threads',
    requestsUrl: 'https://www.threads.com/settings/website_permissions',
    instruction: () =>
      'Đăng nhập Threads bằng đúng tài khoản được mời, vào <strong>Cài đặt → Quyền của trang web → Lời mời</strong> rồi chấp nhận lời mời của ứng dụng Marka.',
    linkLabel: 'Mở trang lời mời Threads',
    followUp: 'Sau khi chấp nhận, quay lại Marka để kết nối kênh Threads.',
  },
};

export const buildTesterInviteEmail = ({
  actorName,
  userEmail,
  platform,
}: TesterInviteEmailInput): { subject: string; html: string } => {
  const copy = TESTER_INVITE_COPY[platform];
  const subject = `[Marka] Lời mời trở thành ${copy.label} Tester`;

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="color: #4338ca;">Bạn được mời làm ${copy.label} Tester</h2>
    <p><strong>${escapeHtml(actorName)}</strong> đã mời bạn trở thành <strong>Tester</strong> cho ứng dụng ${copy.label} của Marka.</p>
    <p>${copy.instruction(userEmail)}</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(copy.requestsUrl)}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        ${copy.linkLabel}
      </a>
    </p>
    <p>${copy.followUp}</p>
    <p style="font-size: 13px; color: #6b7280;">Nếu bạn không thấy lời mời, hãy liên hệ quản trị viên Marka.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">Marka — Nền tảng AI Content đa kênh cho marketer Việt Nam.</p>
  </div>`;

  return { subject, html };
};

export default { buildTesterInviteEmail };
