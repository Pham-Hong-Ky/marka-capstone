import { useId, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarClock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { toDateTimeLocalValue } from '@/utils/format';
import { inputClasses } from './input.styles';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
const pad = (value: number): string => String(value).padStart(2, '0');

const ceilToMinute = (date: Date): Date => {
  const result = new Date(date);
  if (result.getSeconds() > 0 || result.getMilliseconds() > 0) {
    result.setMinutes(result.getMinutes() + 1);
  }
  result.setSeconds(0, 0);
  return result;
};

/**
 * Chọn ngày giờ; `value` là chuỗi dạng `yyyy-MM-ddTHH:mm` (giờ máy), rỗng nghĩa là chưa chọn.
 * Mọi mốc trước `min` đều bị vô hiệu hóa.
 */
export const DateTimeField = ({
  label,
  value,
  onChange,
  min,
  error,
  clearable = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: Date;
  error?: string;
  clearable?: boolean;
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : null;
  const minDate = ceilToMinute(min);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? minDate));

  const emit = (date: Date) => onChange(toDateTimeLocalValue(date < minDate ? minDate : date));

  const pickDay = (day: Date) => {
    const base = selected ?? minDate;
    emit(setMinutes(setHours(day, base.getHours()), base.getMinutes()));
  };

  const days = eachDayOfInterval({
    start: startOfWeek(viewMonth, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });
  const onMinDay = selected ? isSameDay(selected, minDate) : false;
  const canGoPrev = startOfMonth(viewMonth) > startOfMonth(minDate);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex gap-2">
        <button
          id={id}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(inputClasses(error), 'flex items-center justify-between text-left')}
        >
          <span className={selected ? undefined : 'text-subtle'}>
            {selected ? format(selected, 'dd/MM/yyyy HH:mm') : 'Chọn ngày và giờ'}
          </span>
          <CalendarClock className="h-4 w-4 text-muted" aria-hidden="true" />
        </button>
        {clearable && selected ? (
          <button
            type="button"
            aria-label="Xóa ngày giờ"
            onClick={() => onChange('')}
            className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Tháng trước"
              disabled={!canGoPrev}
              onClick={() => setViewMonth((month) => addMonths(month, -1))}
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground">
              Tháng {format(viewMonth, 'M/yyyy')}
            </span>
            <button
              type="button"
              aria-label="Tháng sau"
              onClick={() => setViewMonth((month) => addMonths(month, 1))}
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-1 text-muted">
                {weekday}
              </span>
            ))}
            {days.map((day) => {
              const disabled = day < startOfDay(minDate);
              const isSelected = selected ? isSameDay(day, selected) : false;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={cn(
                    'h-9 rounded-lg text-sm transition disabled:cursor-not-allowed disabled:opacity-30',
                    isSameMonth(day, viewMonth) ? 'text-foreground' : 'text-subtle',
                    isSelected ? 'bg-accent text-white' : !disabled && 'hover:bg-surface-2'
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted">Giờ</span>
            <select
              aria-label="Giờ"
              disabled={!selected}
              value={selected?.getHours() ?? ''}
              onChange={(event) => selected && emit(setHours(selected, Number(event.target.value)))}
              className={cn(inputClasses(), 'w-20')}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour} disabled={onMinDay && hour < minDate.getHours()}>
                  {pad(hour)}
                </option>
              ))}
            </select>
            <span className="text-muted">:</span>
            <select
              aria-label="Phút"
              disabled={!selected}
              value={selected?.getMinutes() ?? ''}
              onChange={(event) =>
                selected && emit(setMinutes(selected, Number(event.target.value)))
              }
              className={cn(inputClasses(), 'w-20')}
            >
              {MINUTES.map((minute) => (
                <option
                  key={minute}
                  value={minute}
                  disabled={
                    onMinDay &&
                    selected?.getHours() === minDate.getHours() &&
                    minute < minDate.getMinutes()
                  }
                >
                  {pad(minute)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-sm font-medium text-accent-text hover:underline"
            >
              Xong
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
};

export default DateTimeField;
