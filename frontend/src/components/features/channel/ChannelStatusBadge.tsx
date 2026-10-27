import Badge from '@/components/ui/Badge';
import { CHANNEL_STATUS_LABELS, type ChannelStatus } from '@/services/channel';

export const ChannelStatusBadge = ({ status }: { status: ChannelStatus }) => (
  <Badge variant={status === 'ACTIVE' ? 'success' : 'warning'}>
    {CHANNEL_STATUS_LABELS[status]}
  </Badge>
);

export default ChannelStatusBadge;
