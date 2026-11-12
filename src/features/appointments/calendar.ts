export function getAppointmentWeekDates(date: string): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  const mondayOffset = (parsedDate.getUTCDay() + 6) % 7;
  parsedDate.setUTCDate(parsedDate.getUTCDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const weekDate = new Date(parsedDate);
    weekDate.setUTCDate(parsedDate.getUTCDate() + index);
    return weekDate.toISOString().slice(0, 10);
  });
}

export function getAppointmentMonthDates(date: string): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [year, month, day] = date.split("-").map(Number);
  const selectedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    selectedDate.getUTCFullYear() !== year ||
    selectedDate.getUTCMonth() + 1 !== month ||
    selectedDate.getUTCDate() !== day
  ) {
    return null;
  }

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leadingDays = (firstDay.getUTCDay() + 6) % 7;
  const monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const gridLength = leadingDays + monthLength <= 35 ? 35 : 42;
  firstDay.setUTCDate(firstDay.getUTCDate() - leadingDays);

  return Array.from({ length: gridLength }, (_, index) => {
    const calendarDate = new Date(firstDay);
    calendarDate.setUTCDate(firstDay.getUTCDate() + index);
    return calendarDate.toISOString().slice(0, 10);
  });
}
