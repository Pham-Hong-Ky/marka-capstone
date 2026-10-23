import brandVoiceRepository from './brandvoice.repository.js';
import auditService from '../audit/audit.service.js';
import type { BrandVoiceInput } from './brandvoice.validation.js';
import { NotFoundError } from '../../utils/errors/index.js';

const dedupeKeywords = (keywords: string[]) => [...new Set(keywords)];

export const getBrandVoice = async (workspaceId: string) => {
  const workspace = await brandVoiceRepository.getBrandVoiceByWorkspaceId(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  const brandVoice = workspace.brandVoice ?? null;

  return { brandVoice, isConfigured: brandVoice !== null };
};

export const updateBrandVoice = async (
  workspaceId: string,
  userId: string,
  data: BrandVoiceInput
) => {
  const workspace = await brandVoiceRepository.findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new NotFoundError('Workspace không tồn tại');
  }

  const brandVoice: BrandVoiceInput = {
    ...data,
    keywordsShouldUse: dedupeKeywords(data.keywordsShouldUse),
    keywordsAvoid: dedupeKeywords(data.keywordsAvoid),
  };

  await brandVoiceRepository.updateWorkspaceBrandVoice(workspaceId, brandVoice);

  await auditService.recordAuditLog({
    workspaceId,
    actorId: userId,
    action: 'BRAND_VOICE_UPDATED',
    targetType: 'Workspace',
    targetId: workspaceId,
  });

  return { brandVoice, isConfigured: true };
};

export default {
  getBrandVoice,
  updateBrandVoice,
};
