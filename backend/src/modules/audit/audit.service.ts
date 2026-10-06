import auditRepository, { type AuditLogData } from './audit.repository.js';

export const recordAuditLog = async (data: AuditLogData) => {
  try {
    return await auditRepository.createAuditLog(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('⚠️ Ghi Audit Log thất bại:', message);
    return null;
  }
};

export default {
  recordAuditLog,
};
