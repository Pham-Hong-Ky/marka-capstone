export interface UpcomingHoliday {
  name: string;
  date: Date;
  daysLeft: number;
}

interface FixedHoliday {
  month: number;
  day: number;
  name: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SOLAR_HOLIDAYS: FixedHoliday[] = [
  { month: 1, day: 1, name: 'Tết Dương lịch' },
  { month: 2, day: 14, name: 'Lễ Tình nhân (Valentine)' },
  { month: 3, day: 8, name: 'Ngày Quốc tế Phụ nữ' },
  { month: 4, day: 30, name: 'Ngày Giải phóng miền Nam' },
  { month: 5, day: 1, name: 'Ngày Quốc tế Lao động' },
  { month: 6, day: 1, name: 'Ngày Quốc tế Thiếu nhi' },
  { month: 9, day: 2, name: 'Quốc khánh Việt Nam' },
  { month: 10, day: 20, name: 'Ngày Phụ nữ Việt Nam' },
  { month: 11, day: 20, name: 'Ngày Nhà giáo Việt Nam' },
  { month: 12, day: 25, name: 'Lễ Giáng sinh' },
];

// Ngày dương lịch của các lễ âm lịch, tính theo lịch âm Việt Nam (UTC+7).
const LUNAR_HOLIDAYS: Record<string, string> = {
  '2026-02-17': 'Tết Nguyên Đán',
  '2026-04-26': 'Giỗ Tổ Hùng Vương',
  '2026-08-27': 'Lễ Vu Lan',
  '2026-09-25': 'Tết Trung thu',
  '2027-02-06': 'Tết Nguyên Đán',
  '2027-04-16': 'Giỗ Tổ Hùng Vương',
  '2027-08-16': 'Lễ Vu Lan',
  '2027-09-15': 'Tết Trung thu',
  '2028-01-26': 'Tết Nguyên Đán',
  '2028-04-04': 'Giỗ Tổ Hùng Vương',
  '2028-09-03': 'Lễ Vu Lan',
  '2028-10-03': 'Tết Trung thu',
  '2029-02-13': 'Tết Nguyên Đán',
  '2029-04-23': 'Giỗ Tổ Hùng Vương',
  '2029-08-24': 'Lễ Vu Lan',
  '2029-09-22': 'Tết Trung thu',
};

const startOfDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const parseIsoDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const listHolidaysOfYear = (year: number): Array<{ name: string; date: Date }> => {
  const solar = SOLAR_HOLIDAYS.map(({ month, day, name }) => ({
    name,
    date: new Date(year, month - 1, day),
  }));
  const lunar = Object.entries(LUNAR_HOLIDAYS)
    .filter(([isoDate]) => isoDate.startsWith(`${year}-`))
    .map(([isoDate, name]) => ({ name, date: parseIsoDate(isoDate) }));

  return [...solar, ...lunar];
};

export const getUpcomingHolidays = (now: Date, withinDays: number): UpcomingHoliday[] => {
  const today = startOfDay(now);
  const year = today.getFullYear();

  return [...listHolidaysOfYear(year), ...listHolidaysOfYear(year + 1)]
    .map(({ name, date }) => ({
      name,
      date,
      daysLeft: Math.round((date.getTime() - today.getTime()) / MS_PER_DAY),
    }))
    .filter(({ daysLeft }) => daysLeft >= 0 && daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
};
