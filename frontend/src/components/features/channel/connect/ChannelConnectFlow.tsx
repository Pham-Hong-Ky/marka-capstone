import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import ChannelAccountPickerModal from '@/components/features/channel/ChannelAccountPickerModal';
import {
  FACEBOOK_ERROR_MESSAGES,
  getChannelPlatformMeta,
  type ChannelPlatform,
} from '@/services/channel';
import { queryKeys } from '@/lib/queryKeys';

export const ChannelConnectFlow = ({ workspaceId }: { workspaceId: string }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState<{
    platform: ChannelPlatform;
    sessionId: string;
  } | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const connected = searchParams.get('connected');
    const connect = searchParams.get('connect');
    const errorCode = searchParams.get('connect_error');

    if (!connected && !connect && !errorCode) return;

    if (connected) {
      toast.success(`Kết nối ${getChannelPlatformMeta(connected).label} thành công`);
      void qc.invalidateQueries({ queryKey: queryKeys.channel.list(workspaceId) });
    } else if (connect) {
      const sessionId = searchParams.get('session');
      if (sessionId) {
        setPending({ platform: connect.toUpperCase() as ChannelPlatform, sessionId });
      }
    } else if (errorCode) {
      const platform = searchParams.get('platform') ?? '';
      toast.error(
        FACEBOOK_ERROR_MESSAGES[errorCode] ??
          `Kết nối ${getChannelPlatformMeta(platform).label} thất bại. Vui lòng thử lại.`
      );
    }

    setSearchParams({}, { replace: true });
  }, [qc, searchParams, setSearchParams, workspaceId]);

  const closePicker = () => setPending(null);

  return (
    <ChannelAccountPickerModal
      open={Boolean(pending)}
      platform={pending?.platform ?? 'FACEBOOK'}
      workspaceId={workspaceId}
      sessionId={pending?.sessionId ?? null}
      onClose={closePicker}
    />
  );
};

export default ChannelConnectFlow;
