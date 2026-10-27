import Alert from '@/components/ui/Alert';
import type { AnalyticsCoverage } from '@/services/analytics';
import { formatDateTime } from '@/utils/format';

export const CoverageAlert = ({ coverage }: { coverage: AnalyticsCoverage }) => {
  if (coverage.publishedPosts === 0) {
    return null;
  }

  if (coverage.syncedPosts >= coverage.publishedPosts) {
    return null;
  }

  return (
    <Alert variant="warning" title="Chưa đủ số liệu">
      <p>
        Đã đồng bộ {coverage.syncedPosts}/{coverage.publishedPosts} bài.
      </p>
      {coverage.missingImpressions > 0 ? <p>Một số Page không trả về impressions.</p> : null}
      <p>
        {coverage.lastSyncedAt
          ? `Đồng bộ lần cuối: ${formatDateTime(coverage.lastSyncedAt)}.`
          : 'Chưa đồng bộ lần nào.'}
      </p>
    </Alert>
  );
};

export default CoverageAlert;
