// The workshop operates in Casablanca, regardless of the server's own timezone.
const BUSINESS_TIME_ZONE = 'Africa/Casablanca';

type CalendarDay = {
  year: number;
  month: number;
  day: number;
};

export type DayBounds = {
  start: Date;
  end: Date;
};

function getCalendarDay(date: Date): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(
    parts.find((part) => part.type === type)?.value,
  );

  return { year: value('year'), month: value('month'), day: value('day') };
}

function getTimeZoneOffsetMilliseconds(date: Date): number {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;

  if (!timeZoneName || timeZoneName === 'GMT') return 0;

  const match = timeZoneName.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const offsetMinutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === '+' ? 1 : -1) * offsetMinutes * 60_000;
}

function startOfBusinessDay({ year, month, day }: CalendarDay): Date {
  const utcMidnight = Date.UTC(year, month - 1, day);
  const offset = getTimeZoneOffsetMilliseconds(new Date(utcMidnight));
  return new Date(utcMidnight - offset);
}

/** Returns the current calendar day's bounds in the workshop's timezone. */
export function getCurrentBusinessDayBounds(now = new Date()): DayBounds {
  const today = getCalendarDay(now);
  const tomorrowDate = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const tomorrow: CalendarDay = {
    year: tomorrowDate.getUTCFullYear(),
    month: tomorrowDate.getUTCMonth() + 1,
    day: tomorrowDate.getUTCDate(),
  };

  return {
    start: startOfBusinessDay(today),
    end: startOfBusinessDay(tomorrow),
  };
}
