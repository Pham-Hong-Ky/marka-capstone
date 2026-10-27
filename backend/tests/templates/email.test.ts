import { describe, expect, it } from 'vitest';
import { buildWorkspaceInviteEmail } from '../../src/templates/workspaceInviteEmail.js';
import { buildPostSubmittedEmail } from '../../src/templates/postReviewEmail.js';

describe('Email templates', () => {
  it('escape HTML trong nội dung người dùng nhập', () => {
    const { html } = buildWorkspaceInviteEmail({
      workspaceName: '<img src=x onerror=alert(1)>',
      inviterName: '<b>Kẻ tấn công</b>',
      roleLabel: 'OWNER',
      inviteUrl: 'https://app.marka.vn/invites/abc',
    });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Kẻ');
    expect(html).toContain('&lt;img src=x');
  });

  it('loại newline khỏi subject', () => {
    const { subject } = buildPostSubmittedEmail({
      workspaceName: 'WS',
      postTitle: 'Tiêu đề\r\nBcc: x',
      submitterName: 'A',
    });

    expect(subject).not.toContain('\n');
    expect(subject).not.toContain('\r');
  });
});
