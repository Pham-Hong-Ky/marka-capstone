import ChannelPlatformBadge from '@/components/features/channel/ChannelPlatformBadge';
import Card, { CardHeader } from '@/components/ui/Card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { AnalyticsChannelBreakdown } from '@/services/analytics';
import { formatNumber } from '@/utils/format';

const formatOptional = (value: number | null): string =>
  value === null ? '—' : formatNumber(value);

const formatRate = (value: number | null): string => (value === null ? '—' : `${value}%`);

export const ChannelBreakdownCard = ({
  channels,
  onSelectChannel,
}: {
  channels: AnalyticsChannelBreakdown[];
  onSelectChannel?: (channelId: string) => void;
}) => {
  if (channels.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Hiệu quả theo kênh"
        description="Số liệu của từng kênh trong khoảng thời gian đã chọn"
      />
      <div className="px-4 pb-4">
        <Table>
          <THead>
            <TR>
              <TH scope="col">Kênh</TH>
              <TH scope="col" className="text-right">Bài</TH>
              <TH scope="col" className="text-right">Tương tác</TH>
              <TH scope="col" className="text-right">Lượt xem</TH>
              <TH scope="col" className="hidden text-right sm:table-cell">Tiếp cận</TH>
              <TH scope="col" className="hidden text-right sm:table-cell">Tỷ lệ tương tác</TH>
            </TR>
          </THead>
          <TBody>
            {channels.map((channel) => (
              <TR key={channel.channelId}>
                <TD>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <ChannelPlatformBadge platform={channel.platform} />
                    {onSelectChannel ? (
                      <button
                        type="button"
                        onClick={() => onSelectChannel(channel.channelId)}
                        className="min-h-11 truncate text-left font-medium text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {channel.name}
                      </button>
                    ) : (
                      <span className="truncate font-medium text-foreground">{channel.name}</span>
                    )}
                  </div>
                </TD>
                <TD className="text-right tabular-nums">{formatNumber(channel.posts)}</TD>
                <TD className="text-right tabular-nums">{formatNumber(channel.engagement)}</TD>
                <TD className="text-right tabular-nums">{formatOptional(channel.impressions)}</TD>
                <TD className="hidden text-right tabular-nums sm:table-cell">
                  {formatOptional(channel.reach)}
                </TD>
                <TD className="hidden text-right tabular-nums sm:table-cell">
                  {formatRate(channel.engagementRate)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
};

export default ChannelBreakdownCard;
