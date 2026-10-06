export interface WorkspaceInviteEmailInput {
  workspaceName: string;
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
}

export const buildWorkspaceInviteEmail = ({
  workspaceName,
  inviterName,
  roleLabel,
  inviteUrl,
}: WorkspaceInviteEmailInput): { subject: string; html: string } => {
  const subject = `Lời mời tham gia workspace "${workspaceName}" trên Marka`;

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="color: #4338ca;">Bạn được mời tham gia workspace</h2>
    <p><strong>${inviterName}</strong> đã mời bạn tham gia workspace <strong>${workspaceName}</strong> với vai trò <strong>${roleLabel}</strong>.</p>
    <p>Nhấn nút bên dưới để chấp nhận lời mời. Liên kết có hiệu lực trong 7 ngày.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
        Chấp nhận lời mời
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">Nếu bạn không mong đợi email này, hãy bỏ qua nó.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">Marka — Nền tảng AI Content đa kênh cho marketer Việt Nam.</p>
  </div>`;

  return { subject, html };
};

export default { buildWorkspaceInviteEmail };
