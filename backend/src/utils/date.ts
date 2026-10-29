export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfVnDay = (date: Date): Date => {
  const shifted = date.getTime() + VN_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - VN_OFFSET_MS);
};

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

export const getVnHour = (date: Date): number =>
  new Date(date.getTime() + VN_OFFSET_MS).getUTCHours();

export default { VN_OFFSET_MS, DAY_MS, startOfVnDay, addDays, getVnHour };
