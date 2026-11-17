import { useMemo } from 'react';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { getUpcomingHolidays } from '@/utils/holidays';

const UPCOMING_WINDOW_DAYS = 30;
const URGENT_DAYS = 7;

const formatDaysLeft = (daysLeft: number): string => {
  if (daysLeft === 0) return 'Hôm nay';
  if (daysLeft === 1) return 'Ngày mai';
  return `Còn ${daysLeft} ngày`;
};

const formatShortDate = (date: Date): string =>
  date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

export const ContentTipsCard = () => {
  const holidays = useMemo(() => getUpcomingHolidays(new Date(), UPCOMING_WINDOW_DAYS), []);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">Gợi ý nội dung</h2>

      {holidays.length === 0 ? (
        <EmptyState
          title={`Chưa có ngày lễ nào trong ${UPCOMING_WINDOW_DAYS} ngày tới.`}
          className="mt-4 px-4 py-8"
        />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {holidays.map(({ name, date, daysLeft }) => (
            <li key={`${name}-${date.getTime()}`} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={daysLeft <= URGENT_DAYS ? 'warning' : 'neutral'}>
                  {formatDaysLeft(daysLeft)}
                </Badge>
                <p className="text-[13px] font-medium text-foreground">
                  {formatShortDate(date)} · {name}
                </p>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                Sắp tới {name}, bạn đã có ý tưởng nội dung nào chưa?
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ContentTipsCard;
