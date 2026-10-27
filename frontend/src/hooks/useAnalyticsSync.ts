import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSyncAnalytics } from '@/hooks/useAnalytics';
import type { AnalyticsCoverage } from '@/services/analytics';

const SYNC_TIMEOUT_MS = 60_000;

const hasNewCoverage = (coverage: AnalyticsCoverage, baseline: AnalyticsCoverage): boolean =>
  coverage.lastSyncedAt !== baseline.lastSyncedAt || coverage.syncedPosts > baseline.syncedPosts;

interface SyncBaseline {
  syncKey: string;
  coverage: AnalyticsCoverage;
}

export const useAnalyticsSync = ({
  workspaceId,
  coverage,
  syncKey,
}: {
  workspaceId: string | null;
  coverage?: AnalyticsCoverage;
  syncKey: string;
}) => {
  const queryClient = useQueryClient();
  const sync = useSyncAnalytics(workspaceId);
  const resetSync = sync.reset;
  const [baseline, setBaseline] = useState<SyncBaseline | null>(null);
  const prevSyncKey = useRef(syncKey);
  const isWaiting = baseline !== null && baseline.syncKey === syncKey;

  const start = () => {
    if (sync.isPending || isWaiting || !workspaceId) {
      return;
    }

    setBaseline(coverage ? { syncKey, coverage } : null);
    sync.mutate();
  };

  useEffect(() => {
    if (prevSyncKey.current === syncKey) {
      return;
    }

    prevSyncKey.current = syncKey;
    setBaseline(null);
    resetSync();
  }, [syncKey, resetSync]);

  useEffect(() => {
    if (!baseline || baseline.syncKey !== syncKey || !coverage) {
      return;
    }

    if (!hasNewCoverage(coverage, baseline.coverage)) {
      return;
    }

    setBaseline(null);
    queryClient.invalidateQueries({ queryKey: ['analytics', 'suggestions'] });
    toast.success('Đã cập nhật số liệu mới.');
  }, [baseline, coverage, queryClient, syncKey]);

  useEffect(() => {
    if (baseline && sync.isError) {
      setBaseline(null);
    }
  }, [baseline, sync.isError]);

  useEffect(() => {
    if (!isWaiting) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBaseline(null);
      toast('Chưa có số liệu mới, vui lòng thử lại sau.');
    }, SYNC_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [isWaiting]);

  return { start, isWaiting, error: sync.error };
};

export default useAnalyticsSync;
