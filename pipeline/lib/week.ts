import { formatInTimeZone } from 'date-fns-tz';

/**
 * DST-safe week calculator.
 *
 * This was flagged by the architect as the single highest-risk bug in a naive
 * port of the routine: Railway's cron fires in UTC, and US clocks change
 * twice a year (spring forward in March, fall back in November). Naive UTC
 * date math (e.g. `new Date(now.getTime() - N * 86400000)`) silently
 * miscomputes the week boundary on weeks that straddle a DST transition,
 * because a "day" is not always exactly 86,400,000ms in wall-clock terms.
 *
 * Approach: never do arithmetic on raw millisecond offsets across a
 * timezone-aware boundary. Instead:
 *   1. Use `formatInTimeZone` (date-fns-tz) to read the NY *wall-clock*
 *      calendar date and ISO weekday (1=Mon..7=Sun) for the given instant.
 *      This is safe regardless of the deployment machine's own TZ setting
 *      and correctly accounts for whichever UTC offset (EST/EDT) applies
 *      to that specific instant.
 *   2. From that point on, only do pure calendar-day arithmetic using
 *      `Date.UTC` (which has no DST -- UTC never shifts), operating on
 *      the extracted Y/M/D integers rather than on live Date instants.
 *
 * This sidesteps the ambiguity around whether a given date-fns-tz "zoned
 * date" is meant to be read with local vs. UTC getters entirely -- we only
 * ever ask date-fns-tz "what NY calendar date/weekday is this instant?",
 * then hand off to unambiguous, DST-free UTC calendar math.
 */

const NY_TIME_ZONE = 'America/New_York';

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDateString({ year, month, day }: CalendarDate): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Reads the NY wall-clock calendar date and ISO weekday (1=Mon..7=Sun) for a given instant. */
function nyCalendarParts(instant: Date): { date: CalendarDate; isoWeekday: number } {
  const ymd = formatInTimeZone(instant, NY_TIME_ZONE, 'yyyy-MM-dd');
  const [year, month, day] = ymd.split('-').map(Number);
  const isoWeekday = Number(formatInTimeZone(instant, NY_TIME_ZONE, 'i'));
  return { date: { year, month, day }, isoWeekday };
}

/** Adds (or subtracts, if negative) whole calendar days to a Y/M/D date. Pure UTC math -- no DST. */
function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

export interface WeekRange {
  weekStart: string; // ISO date (YYYY-MM-DD), Monday
  weekEnd: string; // ISO date (YYYY-MM-DD), Sunday, weekStart + 6 days
}

/**
 * Given "now," returns the Monday-starting ISO week that just ended, computed
 * via explicit America/New_York wall-clock conversion.
 *
 * "Just ended" means: find the Monday that starts the NY-local week containing
 * `now`, then step back exactly one full week from there. This matches the
 * spec's STEP 0 ("week_start = Monday starting the Mon-Sun week that just
 * ended") regardless of what day/time this runs -- a Monday 12:05am ET cron
 * fire will correctly compute last week's Mon-Sun range, and so will a
 * mid-week manual run.
 */
export function computeWeek(now: Date = new Date()): WeekRange {
  const { date, isoWeekday } = nyCalendarParts(now);
  const daysSinceMonday = isoWeekday - 1; // Mon=0 ... Sun=6
  const currentWeekMonday = addCalendarDays(date, -daysSinceMonday);
  const lastWeekMonday = addCalendarDays(currentWeekMonday, -7);
  const lastWeekSunday = addCalendarDays(lastWeekMonday, 6);

  return {
    weekStart: toIsoDateString(lastWeekMonday),
    weekEnd: toIsoDateString(lastWeekSunday),
  };
}
