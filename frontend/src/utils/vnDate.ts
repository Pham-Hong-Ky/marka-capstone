const parseVnDate = (value: string): Date | undefined => {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const startOfVnDayIso = (date: string) =>
  parseVnDate(`${date}T00:00:00+07:00`)?.toISOString();

export const endOfVnDayIso = (date: string) =>
  parseVnDate(`${date}T23:59:59.999+07:00`)?.toISOString();
