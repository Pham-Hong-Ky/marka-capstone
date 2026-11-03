import { useState, type DragEvent } from 'react';
import { eachDayOfInterval, format, isSameDay, isSameMonth, isToday } from 'date-fns';
import {
  SCHEDULE_STATUS_BADGE_CLASSES,
  SCHEDULE_STATUS_DOT_CLASSES,
  type ScheduleItem,
} from '@/services/schedule';
import { cn } from '@/utils/cn';
import { getCalendarRange, getScheduleDate, toDayKey } from '@/utils/schedule';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MAX_CHIPS = 2;
const MAX_DOTS = 3;

export const ScheduleCalendar = ({
  month,
  schedulesByDay,
  selectedDate,
  onSelectDate,
  canDragSchedule,
  onDropSchedule,
}: {
  month: Date;
  schedulesByDay: Map<string, ScheduleItem[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  canDragSchedule?: (schedule: ScheduleItem) => boolean;
  onDropSchedule?: (schedule: ScheduleItem, date: Date) => void;
}) => {
  const { start, end } = getCalendarRange(month);
  const days = eachDayOfInterval({ start, end });
  const [draggingSchedule, setDraggingSchedule] = useState<ScheduleItem | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLSpanElement>, schedule: ScheduleItem) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', schedule.id);
    setDraggingSchedule(schedule);
  };

  const handleDragEnd = () => {
    setDraggingSchedule(null);
    setDragOverDayKey(null);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>, day: Date) => {
    if (!draggingSchedule || !onDropSchedule) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverDayKey(toDayKey(day));
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, day: Date) => {
    if (!draggingSchedule || !onDropSchedule) return;
    event.preventDefault();
    onDropSchedule(draggingSchedule, day);
    setDraggingSchedule(null);
    setDragOverDayKey(null);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/60">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = schedulesByDay.get(toDayKey(day)) ?? [];
          const inMonth = isSameMonth(day, month);
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={selected}
              aria-label={`${format(day, 'dd/MM/yyyy')}${items.length ? `, ${items.length} bài đăng` : ''}`}
              onClick={() => onSelectDate(day)}
              onDragOver={(event) => handleDragOver(event, day)}
              onDrop={(event) => handleDrop(event, day)}
              className={cn(
                'flex min-h-14 flex-col gap-1 border-b border-r border-border p-1.5 text-left transition hover:bg-surface-2 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:min-h-20 [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-surface-2/50',
                selected && 'bg-accent/5 ring-2 ring-inset ring-accent',
                draggingSchedule &&
                  dragOverDayKey === toDayKey(day) &&
                  'bg-accent/10 ring-2 ring-inset ring-accent'
              )}
            >
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-[11px] font-medium',
                  inMonth ? 'text-foreground' : 'text-subtle',
                  today && 'bg-accent text-white'
                )}
              >
                {format(day, 'd')}
              </span>

              {items.length > 0 ? (
                <>
                  <span className="flex flex-wrap gap-1 sm:hidden">
                    {items.slice(0, MAX_DOTS).map((item) => (
                      <span
                        key={item.id}
                        className={cn('h-1.5 w-1.5 rounded-full', SCHEDULE_STATUS_DOT_CLASSES[item.status])}
                      />
                    ))}
                  </span>

                  <span className="hidden min-w-0 flex-col gap-1 sm:flex">
                    {items.slice(0, MAX_CHIPS).map((item) => {
                      const draggable = Boolean(onDropSchedule && canDragSchedule?.(item));

                      return (
                        <span
                          key={item.id}
                          draggable={draggable}
                          onDragStart={
                            draggable ? (event) => handleDragStart(event, item) : undefined
                          }
                          onDragEnd={draggable ? handleDragEnd : undefined}
                          title={draggable ? 'Kéo sang ngày khác để đổi lịch' : undefined}
                          className={cn(
                            'truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-4',
                            SCHEDULE_STATUS_BADGE_CLASSES[item.status],
                            draggable && 'cursor-grab select-none active:cursor-grabbing',
                            draggingSchedule?.id === item.id && 'opacity-50'
                          )}
                        >
                          {format(getScheduleDate(item), 'HH:mm')} {item.post.title}
                        </span>
                      );
                    })}
                    {items.length > MAX_CHIPS ? (
                      <span className="px-1.5 text-[11px] text-muted">
                        +{items.length - MAX_CHIPS} bài khác
                      </span>
                    ) : null}
                  </span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleCalendar;
