import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import type { AnalyticsSuggestions, BestTimeSlot } from '@/services/analytics';
import { formatNumber } from '@/utils/format';

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const formatWeekday = (weekday: number | null): string =>
  weekday === null ? 'Mọi ngày' : WEEKDAY_LABELS[weekday] ?? 'Mọi ngày';

const formatHourRange = (slot: BestTimeSlot): string =>
  `${String(slot.startHour).padStart(2, '0')}:00–${String(slot.endHour).padStart(2, '0')}:00`;

const slotKey = (slot: BestTimeSlot): string =>
  `${slot.weekday ?? 'all'}-${slot.startHour}-${slot.endHour}`;

export const BestTimesCard = ({ suggestions }: { suggestions: AnalyticsSuggestions }) => (
  <section className="rounded-2xl border border-border bg-surface p-5">
    <h2 className="text-base font-semibold text-foreground">Khung giờ tốt</h2>

    {suggestions.usedFallback ? (
      <Alert variant="info" className="mt-4">
        Đang dùng khung giờ tham khảo vì chưa đủ dữ liệu.
      </Alert>
    ) : null}

    {suggestions.bestTimes.length === 0 ? (
      <EmptyState title="Chưa đủ dữ liệu để gợi ý khung giờ." className="mt-4 px-4 py-8" />
    ) : (
      <ul className="mt-4 divide-y divide-border">
        {suggestions.bestTimes.map((slot) => (
          <li
            key={slotKey(slot)}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0"
          >
            <div>
              <p className="font-medium text-foreground">{formatWeekday(slot.weekday)}</p>
              <p className="text-muted">{formatHourRange(slot)}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground">
                {slot.engagementRate !== null ? `${slot.engagementRate}%` : '—'}
              </p>
              <p className="text-xs text-muted">{formatNumber(slot.postCount)} bài</p>
            </div>
          </li>
        ))}
      </ul>
    )}

    <p className="mt-4 text-xs text-muted">
      Dựa trên {formatNumber(suggestions.sampleSize)} bài trong {suggestions.windowDays} ngày.
    </p>
  </section>
);

export default BestTimesCard;
