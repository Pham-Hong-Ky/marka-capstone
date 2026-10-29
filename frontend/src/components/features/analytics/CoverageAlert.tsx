import Alert from '@/components/ui/Alert';
import type { AnalyticsCoverage } from '@/services/analytics';
import { formatDateTime } from '@/utils/format';

export const CoverageAlert = ({ coverage }: { coverage: AnalyticsCoverage }) => {
  if (coverage.publishedPosts === 0) {
    return null;
  }

  const lastSynced = coverage.lastSyncedAt
    ? `Đồng bộ lần cuối: ${formatDateTime(coverage.lastSyncedAt)}.`
    : 'Chưa đồng bộ lần nào.';
  const hasMissingImpressions = coverage.missingImpressions > 0;

  if (coverage.syncedPosts < coverage.publishedPosts) {
    return (
      <Alert variant="warning" title="Chưa đủ số liệu">
        <p>
          Đã đồng bộ {coverage.syncedPosts}/{coverage.publishedPosts} bài.
        </p>
        {hasMissingImpressions ? <p>Một số Page không trả về impressions.</p> : null}
        <p>{lastSynced}</p>
      </Alert>
    );
  }

  if (hasMissingImpressions) {
    return (
      <Alert variant="info" title="Thiếu dữ liệu hiển thị">
        <p>Một số Page không trả về impressions.</p>
        <p>{lastSynced}</p>
      </Alert>
    );
  }

  return null;
};

export default CoverageAlert;
