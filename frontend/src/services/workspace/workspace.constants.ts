import type { WorkspaceRole } from '@/services/auth';

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Chủ sở hữu',
  CONTENT_CREATOR: 'Người sáng tạo nội dung',
};
