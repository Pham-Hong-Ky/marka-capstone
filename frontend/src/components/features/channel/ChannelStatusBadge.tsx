import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { CHANNEL_STATUS_LABELS, type ChannelStatus } from '@/services/channel';

const STATUS_VARIANTS: Record<ChannelStatus, BadgeVariant> = {
  ACTIVE: 'success',
  EXPIRED: 'warning',
};

export const ChannelStatusBadge = ({ status }: { status: ChannelStatus }) => (
  <Badge variant={STATUS_VARIANTS[status]}>{CHANNEL_STATUS_LABELS[status]}</Badge>
);

export default ChannelStatusBadge;
