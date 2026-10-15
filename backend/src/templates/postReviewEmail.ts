const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface PostSubmittedEmailInput {
  workspaceName: string;
  postTitle: string;
  submitterName: string;
}

export const buildPostSubmittedEmail = ({
  workspaceName,
  postTitle,
  submitterName,
}: PostSubmittedEmailInput): { subject: string; html: string } => {
  const title = escapeHtml(postTitle);
  const subject = `[Marka] Bài viết "${postTitle}" đang chờ duyệt`;

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="color: #4338ca;">Có bài viết chờ bạn duyệt</h2>
    <p><strong>${escapeHtml(submitterName)}</strong> đã gửi duyệt bài viết <strong>${title}</strong> trong workspace <strong>${escapeHtml(workspaceName)}</strong>.</p>
    <p>Vui lòng mở Marka để xem nội dung và phê duyệt hoặc từ chối bài viết.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">Marka — Nền tảng AI Content đa kênh cho marketer Việt Nam.</p>
  </div>`;

  return { subject, html };
};

export interface PostReviewedEmailInput {
  workspaceName: string;
  postTitle: string;
  approved: boolean;
  rejectReason?: string | null;
}

export const buildPostReviewedEmail = ({
  workspaceName,
  postTitle,
  approved,
  rejectReason,
}: PostReviewedEmailInput): { subject: string; html: string } => {
  const title = escapeHtml(postTitle);
  const subject = approved
    ? `[Marka] Bài viết "${postTitle}" đã được duyệt`
    : `[Marka] Bài viết "${postTitle}" bị từ chối`;

  const heading = approved ? 'Bài viết đã được duyệt' : 'Bài viết bị từ chối';
  const body = approved
    ? `<p>Bài viết <strong>${title}</strong> trong workspace <strong>${escapeHtml(workspaceName)}</strong> đã được duyệt. Bạn có thể tiếp tục lên lịch hoặc đăng bài.</p>`
    : `<p>Bài viết <strong>${title}</strong> trong workspace <strong>${escapeHtml(workspaceName)}</strong> đã bị từ chối.</p>
    <p><strong>Lý do:</strong> ${escapeHtml(rejectReason ?? 'Không có lý do cụ thể')}</p>
    <p>Vui lòng chỉnh sửa theo góp ý rồi gửi duyệt lại.</p>`;

  const html = `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
    <h2 style="color: ${approved ? '#4338ca' : '#b91c1c'};">${heading}</h2>
    ${body}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #9ca3af;">Marka — Nền tảng AI Content đa kênh cho marketer Việt Nam.</p>
  </div>`;

  return { subject, html };
};

export default { buildPostSubmittedEmail, buildPostReviewedEmail };
