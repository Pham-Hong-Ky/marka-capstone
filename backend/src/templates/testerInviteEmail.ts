import { escapeHtml } from './email.utils.js';

export interface TesterInviteEmailInput {
  actorName: string;
  userEmail: string;
}

export const TESTER_INVITE_REQUESTS_URL = 'https://developers.facebook.com/settings/developer/requests/';

export const buildTesterInviteEmail = ({
  actorName,
  userEmail,
}: TesterInviteEmailInput): { subject: string; html: string } => {
  const subject = '[Marka] Lời mời trở thành Facebook Tester';

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="color: #4338ca;">Bạn được mời làm Facebook Tester</h2>
    <p><strong>${escapeHtml(actorName)}</strong> đã mời bạn trở thành <strong>Tester</strong> cho ứng dụng Facebook của Marka.</p>
    <p>Đăng nhập Facebook bằng địa chỉ <strong>${escapeHtml(userEmail)}</strong>, mở trang lời mời rồi chấp nhận. Nếu chưa có tài khoản Meta Developer, bạn cần tạo tài khoản trước khi chấp nhận.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${escapeHtml(TESTER_INVITE_REQUESTS_URL)}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Chấp nhận lời mời tester
      </a>
    </p>
    <p>Sau khi chấp nhận, quay lại Marka để kết nối kênh Facebook.</p>
    <p style="font-size: 13px; color: #6b7280;">Nếu bạn không thấy lời mời, hãy liên hệ quản trị viên Marka.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">Marka — Nền tảng AI Content đa kênh cho marketer Việt Nam.</p>
  </div>`;

  return { subject, html };
};

export default { buildTesterInviteEmail };
