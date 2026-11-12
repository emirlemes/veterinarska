const clinicTimeZone = "Europe/Sarajevo";
const clinicDateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: clinicTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatClinicDateTime(value: Date) {
  const parts = Object.fromEntries(
    clinicDateTimeFormatter
      .formatToParts(value)
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function getClinicDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: clinicTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getOffsetAt(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: clinicTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return localTimeAsUtc - instant.getTime();
}

function clinicMidnightUtc(year: number, month: number, day: number): Date {
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  return new Date(midnightAsUtc - getOffsetAt(new Date(midnightAsUtc)));
}

export function clinicDateTimeToUtc(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;

  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const expectedDate = new Date(wallClockAsUtc);
  if (
    expectedDate.getUTCFullYear() !== year ||
    expectedDate.getUTCMonth() + 1 !== month ||
    expectedDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  let instant = new Date(wallClockAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = new Date(wallClockAsUtc - getOffsetAt(instant));
  }

  return formatClinicDateTime(instant) === value ? instant : null;
}

export function getClinicDateBounds(date: string) {
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

  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: clinicMidnightUtc(year, month, day),
    end: clinicMidnightUtc(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
    ),
  };
}

export function getClinicDayBounds(now = new Date()) {
  const date = getClinicDate(now);
  const bounds = getClinicDateBounds(date);
  if (!bounds) throw new Error(`Neispravan datum ambulante: ${date}`);
  return bounds;
}
