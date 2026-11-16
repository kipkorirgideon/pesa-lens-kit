// Payee classification (port of reference/python/bars.py) and small shared helpers.
import type { FbCategory } from './types';
import { PROFILE } from '../profile';

// Bars / lounges / clubs. "BAR" but not "MILK BAR"; "LOUNGE" but not a barber's ("KINYOZI").
const BAR = /\bBAR\b(?!.*MILK)|LOUNGE(?!.*KINYOZI)|\bPUB\b|WINES?\b|LIQUOR|SPIRITS|\bCLUB\b|GARDENS|ROOFTOP|RESORT/i;
// Restaurants, hotels, cafes, fast food.
const FOOD =
  /RESTAURANT|HOTEL|\bCAFE|CAFFE|KITCHEN|CATERER|\bFOODS?\b|PIZZA|\bKFC\b|CHICKEN|JAVA|GRILL|CHOMA|ROAST|EATERY|SNACK|MILK BAR|DOMINO|FOOD COURT|\bREST\b|FISH PALACE|BIG FISH|DINE/i;
// Butcheries / fish mongers.
const MEAT = /BUTCHER|MEAT POINT|FISH MONGER/i;
// Never food/bars even if a keyword above matches (barbers, supermarkets, banks...).
const NOT_FB = /KINYOZI|SUPERMARKET|SACCO|BANK|KITCHENWARE|TYRES/i;

export const FB_CATS: FbCategory[] = ['Bars & lounges', 'Restaurants, hotels & food', 'Butcheries & nyama choma'];

/** Classify a payee name (collapsed, trailing dots stripped). Bar wins over meat, meat over food. */
export function classifyPayee(n: string, extraBars?: Set<string>): FbCategory | null {
  if (extraBars && extraBars.has(n.toUpperCase())) return 'Bars & lounges';
  if (NOT_FB.test(n)) return null;
  if (BAR.test(n) || (PROFILE.extraBarPattern && PROFILE.extraBarPattern.test(n))) return 'Bars & lounges';
  if (MEAT.test(n)) return 'Butcheries & nyama choma';
  if (FOOD.test(n) || (PROFILE.extraFoodPattern && PROFILE.extraFoodPattern.test(n))) return 'Restaurants, hotels & food';
  return null;
}

/** Merge several tills of one venue into a single name (see src/profile.ts). */
export const venueName = (n: string) => PROFILE.venueMerges.find((m) => m.match.test(n))?.name ?? n;

/** Payee name as keyed in payee tables: whitespace collapsed, trailing dots removed. */
export const payeeName = (raw: string) => raw.replace(/\s+/g, ' ').trim().replace(/\.+$/, '');

/** Person key: upper-cased, whitespace collapsed. */
export const personKey = (raw: string) => raw.replace(/\s+/g, ' ').trim().toUpperCase();

// Safaricom data/bundle purchases via paybill.
export const MICRO = /SAFARICOM (OFFERS|DATA|POSTPAID)|Safaricom Limited/i;
// Betting companies (build.py list).
export const BET = /BETIKA|SPORTPESA|ODIBETS|MOZZART|BETWAY|SPORTYBET|SHABIKI/i;
// Credit reference bureaus.
export const CRB = /credit (reference|bureau)|CREDITINFO|METROPOL/i;

// ---- number helpers mimicking Python ----

/** Python round(): half-to-even at exact ties; `nd` decimals. */
export function pyRound(x: number, nd = 0): number {
  if (!isFinite(x)) return x;
  const s = 10 ** nd,
    y = x * s;
  const f = Math.floor(y),
    d = y - f;
  let r: number;
  if (d === 0.5) r = f % 2 === 0 ? f : f + 1;
  else if (nd === 0) r = d < 0.5 ? f : f + 1;
  else return Number(x.toFixed(nd)) === 0 ? 0 : Number(x.toFixed(nd)); // decimal rounding of the exact binary value
  return r / s || 0;
}

/** Thousands-separated integer, like Python f"{x:,.0f}". */
export function intComma(x: number): string {
  const r = pyRound(x);
  const s = Math.abs(r)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (r < 0 ? '-' : '') + s;
}
export const ksh = (x: number) => `KSh ${intComma(x)}`;
/** Short KSh: 58k, 1.47M. */
export function kshShort(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e6) return `KSh ${(x / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (a >= 1e3) return `KSh ${pyRound(x / 1e3)}k`;
  return ksh(x);
}

/** Python str.title(): upper-case a letter that follows a non-letter, lower-case the rest. */
export function pyTitle(s: string): string {
  let prevLetter = false,
    out = '';
  for (const ch of s) {
    const isLetter = /\p{L}/u.test(ch);
    out += isLetter ? (prevLetter ? ch.toLowerCase() : ch.toUpperCase()) : ch;
    prevLetter = isLetter;
  }
  return out;
}
