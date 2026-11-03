/** YYYY-MM-DD for an instant in an IANA timezone. */
export function localDate(d: Date, timeZone: string): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}
const toDay = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const fromDay = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);

/** Consecutive days ending today, or ending yesterday if today is not done yet. */
export function streakCount(dates: string[], today: string): number {
  const set = new Set(dates.map(toDay));
  let day = toDay(today);
  if (!set.has(day)) day -= 1;
  let n = 0;
  while (set.has(day)) { n++; day -= 1; }
  return n;
}

export const FREEZE_MILESTONE_DAYS = 7; // streak length that earns a freeze
export const FREEZE_CAP = 2; // max banked freezes

/** The single missed day a freeze can backfill, or null if there is nothing to patch (streak intact,
 *  already broken more than one day ago, or today itself is the gap and the day isn't over). */
export function freezeGapDate(dates: string[], today: string): string | null {
  const set = new Set(dates.map(toDay));
  const todayDay = toDay(today);
  if (set.has(todayDay) || set.has(todayDay - 1)) return null;
  if (!set.has(todayDay - 2)) return null;
  return fromDay(todayDay - 1);
}

/** The Monday (UTC) that starts the week containing d, as YYYY-MM-DD (matches when stake cohorts start).
 *  Using the Monday's own date rather than an ISO week number keeps this trivially invertible. */
export function weekKey(d: Date): string {
  const day = Math.floor(d.getTime() / 86400000);
  const dow = ((day % 7) + 10) % 7; // days since Monday (1970-01-01 was a Thursday, so +10 mod 7 lands on Monday=0)
  const monday = day - dow;
  return new Date(monday * 86400000).toISOString().slice(0, 10);
}
