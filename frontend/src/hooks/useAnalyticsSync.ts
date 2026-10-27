import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSyncAnalytics } from '@/hooks/useAnalytics';
import type { AnalyticsCoverage } from '@/services/analytics';

const SYNC_TIMEOUT_MS = 60_000;

const hasNewCoverage = (coverage: AnalyticsCoverage, baseline: AnalyticsCoverage): boolean =>
  coverage.lastSyncedAt !== baseline.lastSyncedAt || coverage.syncedPosts > baseline.syncedPosts;

export const useAnalyticsSync = ({
  workspaceId,
  coverage,
}: {
  workspaceId: string | null;
  coverage?: AnalyticsCoverage;
}) => {
  const sync = useSyncAnalytics(workspaceId);
  const [baseline, setBaseline] = useState<AnalyticsCoverage | null>(null);
  const isWaiting = baseline !== null;

  const start = () => {
    if (isWaiting || !workspaceId) {
      return;
    }

    setBaseline(coverage ?? null);
    sync.mutate();
  };

  useEffect(() => {
    if (!baseline || !coverage || !hasNewCoverage(coverage, baseline)) {
      return;
    }

    setBaseline(null);
    toast.success('Đã cập nhật số liệu mới.');
  }, [baseline, coverage]);

  useEffect(() => {
    if (baseline && sync.isError) {
      setBaseline(null);
    }
  }, [baseline, sync.isError]);

  useEffect(() => {
    if (!baseline) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBaseline(null);
      toast('Chưa có số liệu mới, vui lòng thử lại sau.');
    }, SYNC_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [baseline]);

  return { start, isWaiting, error: sync.error };
};

export default useAnalyticsSync;
