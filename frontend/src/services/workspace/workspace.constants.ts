import type { WorkspaceRole } from '@/services/auth';

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Chủ sở hữu',
  CONTENT_CREATOR: 'Người sáng tạo nội dung',
};

export const WORKSPACE_ROLE_OPTIONS = (
  Object.keys(WORKSPACE_ROLE_LABELS) as WorkspaceRole[]
).map((value) => ({ value, label: WORKSPACE_ROLE_LABELS[value] }));
