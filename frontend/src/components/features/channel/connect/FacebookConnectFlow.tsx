import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import FacebookPagePickerModal from '@/components/features/channel/FacebookPagePickerModal';
import { FACEBOOK_ERROR_MESSAGES } from '@/services/channel';

export const FacebookConnectFlow = ({ workspaceId }: { workspaceId: string }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fb = searchParams.get('fb');
    if (!fb) return;

    if (fb === 'select') {
      const sessionId = searchParams.get('session');
      if (sessionId) setPendingSessionId(sessionId);
    } else if (fb === 'error') {
      const reason = searchParams.get('reason') ?? '';
      toast.error(FACEBOOK_ERROR_MESSAGES[reason] ?? 'Kết nối Facebook thất bại. Vui lòng thử lại.');
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const closePicker = () => setPendingSessionId(null);

  return (
    <FacebookPagePickerModal
      open={Boolean(pendingSessionId)}
      workspaceId={workspaceId}
      sessionId={pendingSessionId}
      onClose={closePicker}
    />
  );
};

export default FacebookConnectFlow;
