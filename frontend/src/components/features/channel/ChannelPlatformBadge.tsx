import Badge from '@/components/ui/Badge';
import { getChannelPlatformMeta, type ChannelPlatform } from '@/services/channel';

export const ChannelPlatformBadge = ({
  platform,
  className,
}: {
  platform: ChannelPlatform | string;
  className?: string;
}) => {
  const meta = getChannelPlatformMeta(platform);
  const Icon = meta.icon;

  return (
    <Badge variant="accent" className={className}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {meta.shortLabel}
    </Badge>
  );
};

export default ChannelPlatformBadge;
