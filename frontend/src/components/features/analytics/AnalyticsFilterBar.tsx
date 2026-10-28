import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import SelectField from '@/components/ui/SelectField';
import TextField from '@/components/ui/TextField';
import type { AnalyticsFilters, AnalyticsRange } from '@/services/analytics';
import type { ChannelConnection } from '@/services/channel';

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'mtd', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chọn' },
];

const INVALID_RANGE_MESSAGE = 'Khoảng thời gian không hợp lệ.';
const RANGE_ERROR_ID = 'analytics-range-error';

export const AnalyticsFilterBar = ({
  filters,
  channels,
  tags,
  onChange,
}: {
  filters: AnalyticsFilters;
  channels: ChannelConnection[];
  tags: string[];
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

  const hasSecondaryFilters =
    draftRange !== '7d' || Boolean(filters.channelId) || Boolean(filters.tag);
  const tagOptions = filters.tag && !tags.includes(filters.tag) ? [filters.tag, ...tags] : tags;

  const changeRange = (range: AnalyticsRange) => {
    setDraftRange(range);
    setError(null);

    if (range === 'custom') {
      return;
    }

    onChange({ range, channelId: filters.channelId, tag: filters.tag });
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
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <SelectField
          id="analytics-range"
          name="range"
          label="Khoảng thời gian"
          className="min-h-11"
          value={draftRange}
          onChange={(event) => changeRange(event.target.value as AnalyticsRange)}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

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

        <SelectField
          id="analytics-tag"
          name="tag"
          label="Nhãn"
          className="min-h-11"
          value={filters.tag ?? ''}
          onChange={(event) => onChange({ ...filters, tag: event.target.value || undefined })}
        >
          <option value="">Tất cả nhãn</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </SelectField>

        {hasSecondaryFilters ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full md:w-auto"
              onClick={resetFilters}
            >
              Xoá lọc
            </Button>
          </div>
        ) : null}
      </div>

      {draftRange === 'custom' ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full sm:w-auto"
                onClick={applyCustomRange}
              >
                Áp dụng
              </Button>
            </div>
          </div>

          {error ? (
            <div id={RANGE_ERROR_ID}>
              <Alert variant="danger">{error}</Alert>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsFilterBar;
