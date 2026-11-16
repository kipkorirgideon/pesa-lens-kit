// Money / number formatting helpers (UI only).
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** "KSh 12,345" (rounded to whole shillings). Negative → "−KSh 1,234". */
export function ksh(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = Math.round(v);
  return (r < 0 ? '−KSh ' : 'KSh ') + nf0.format(Math.abs(r));
}
/** Plain number with thousands separators. */
export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return digits ? nf1.format(v) : nf0.format(Math.round(v));
}
export function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf1.format(v) + '%';
}
/** Short form for chart axes: 950, 12k, 1.2M. */
export function short(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) return s + trim(a / 1e6) + 'M';
  if (a >= 1e3) return s + trim(a / 1e3) + 'k';
  return s + nf0.format(a);
}
function trim(x: number): string {
  return x >= 100 ? nf0.format(x) : (Math.round(x * 10) / 10).toString();
}
export function hourLabel(h: number): string {
  return String(h).padStart(2, '0') + ':00';
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2025-03' → 'Mar 2025' */
export function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const i = Number(mo) - 1;
  return MONTHS[i] ? `${MONTHS[i]} ${y}` : m;
}
/** '2025-03' → "Mar '25" for compact axes */
export function monthShort(m: string): string {
  const [y, mo] = m.split('-');
  const i = Number(mo) - 1;
  return MONTHS[i] ? `${MONTHS[i]} '${y.slice(2)}` : m;
}
/** '2026-11-16' or ISO → '16 Nov 2026' */
export function dateLabel(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, mo, day] = d.slice(0, 10).split('-');
  const i = Number(mo) - 1;
  return MONTHS[i] && day ? `${Number(day)} ${MONTHS[i]} ${y}` : d;
}
export const normName = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();
/** Title-case an upper-cased name for display. */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'\-(])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

export const COLORS = { blue: '#2f6fdb', orange: '#e8833a', red: '#d64545', gray: '#b8bec8', green: '#2e9d6a' } as const;
