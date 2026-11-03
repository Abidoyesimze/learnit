/** YYYY-MM-DD for an instant in an IANA timezone. */
export function localDate(d: Date, timeZone: string): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}
const toDay = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

/** Consecutive days ending today, or ending yesterday if today is not done yet. */
export function streakCount(dates: string[], today: string): number {
  const set = new Set(dates.map(toDay));
  let day = toDay(today);
  if (!set.has(day)) day -= 1;
  let n = 0;
  while (set.has(day)) { n++; day -= 1; }
  return n;
}
