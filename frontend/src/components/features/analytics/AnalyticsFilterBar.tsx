import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';
import TextField from '@/components/ui/TextField';
import {
  ANALYTICS_RANGE_OPTIONS,
  type AnalyticsFilters,
  type AnalyticsRange,
} from '@/services/analytics';
import type { ChannelConnection } from '@/services/channel';
import { cn } from '@/utils/cn';

const INVALID_RANGE_MESSAGE = 'Khoảng thời gian không hợp lệ.';
const RANGE_ERROR_ID = 'analytics-range-error';

export const AnalyticsFilterBar = ({
  filters,
  channels,
  onChange,
}: {
  filters: AnalyticsFilters;
  channels: ChannelConnection[];
  onChange: (filters: AnalyticsFilters) => void;
}) => {
  const [draftRange, setDraftRange] = useState<AnalyticsRange>(filters.range);
  const [from, setFrom] = useState(filters.from ?? '');
  const [to, setTo] = useState(filters.to ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftRange(filters.range);
    setFrom(filters.from ?? '');
    setTo(filters.to ?? '');
    setError(null);
  }, [filters.range, filters.from, filters.to]);

  const hasSecondaryFilters = draftRange !== '7d' || Boolean(filters.channelId);

  const changeRange = (range: AnalyticsRange) => {
    setDraftRange(range);
    setError(null);

    if (range === 'custom') {
      return;
    }

    onChange({ range, channelId: filters.channelId });
  };

  const applyCustomRange = () => {
    if (!from || !to || to < from) {
      setError(INVALID_RANGE_MESSAGE);
      return;
    }

    setError(null);
    onChange({ ...filters, range: 'custom', from, to });
  };

  const resetFilters = () => {
    setDraftRange('7d');
    setFrom('');
    setTo('');
    setError(null);
    onChange({ range: '7d' });
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
            Khoảng thời gian
          </span>
          <div
            role="group"
            aria-label="Khoảng thời gian"
            className="flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1"
          >
            {ANALYTICS_RANGE_OPTIONS.map((option) => {
              const active = draftRange === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeRange(option.value)}
                  className={cn(
                    'min-h-11 rounded-md px-2.5 text-[12px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    active
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full sm:w-52">
          <SelectField
            id="analytics-channel"
            name="channelId"
            label="Kênh"
            className="min-h-11"
            value={filters.channelId ?? ''}
            onChange={(event) =>
              onChange({ ...filters, channelId: event.target.value || undefined })
            }
          >
            <option value="">Tất cả kênh</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.label ?? channel.name}
              </option>
            ))}
          </SelectField>
        </div>

        {hasSecondaryFilters ? (
          <Button type="button" variant="ghost" className="min-h-11" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" />
            Xoá lọc
          </Button>
        ) : null}
      </div>

      {draftRange === 'custom' ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField
              id="analytics-from"
              name="from"
              type="date"
              label="Từ ngày"
              className="min-h-11"
              value={from}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? RANGE_ERROR_ID : undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setError(null);
              }}
            />
            <TextField
              id="analytics-to"
              name="to"
              type="date"
              label="Đến ngày"
              className="min-h-11"
              value={to}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? RANGE_ERROR_ID : undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setError(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:w-auto"
              onClick={applyCustomRange}
            >
              Áp dụng
            </Button>
          </div>

          {error ? (
            <div id={RANGE_ERROR_ID} className="mt-3">
              <Alert variant="danger">{error}</Alert>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsFilterBar;
