// Nairobi-time helpers (UTC+3, no DST). Pure; no Intl dependency so results are identical in Node and browsers.

const OFFSET_MS = 3 * 3600 * 1000;
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Shift epoch ms to a Date whose UTC fields read as Nairobi local time. Seconds are floored like Python's fromtimestamp. */
function local(ts: number): Date {
  return new Date(Math.floor(ts / 1000) * 1000 + OFFSET_MS);
}

/** 'YYYY-MM-DDTHH:mm' in Nairobi time. */
export function isoMinute(ts: number): string {
  const d = local(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export interface LocalParts {
  date: string;
  month: string;
  year: number;
  hour: number;
  weekday: number; /* Mon=0 */
}

export function parts(ts: number): LocalParts {
  const d = local(ts);
  const y = d.getUTCFullYear(),
    mo = pad(d.getUTCMonth() + 1);
  return {
    date: `${y}-${mo}-${pad(d.getUTCDate())}`,
    month: `${y}-${mo}`,
    year: y,
    hour: d.getUTCHours(),
    weekday: (d.getUTCDay() + 6) % 7,
  };
}

/** Every 'YYYY-MM' from a to b inclusive. */
export function monthRange(a: string, b: string): string[] {
  const out: string[] = [];
  let [y, m] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  while (y < by || (y === by && m <= bm)) {
    out.push(`${y}-${pad(m)}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Weekday (Mon=0) of a 'YYYY-MM-DD' calendar date. */
export function weekdayOfDate(date: string): number {
  return (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
}
