// Analysis — TypeScript port of reference/python/{agg,build,biztime,biz100,bars,drains,flags2,loans}.py.
// Pure: no DOM, no network; runs in Node and the browser.
import type {
  Analysis, BizDayTopRow, BizDowRow, BizGridRow, BizHourRow, BizPartRow, CategoryRow, DrainBarRow, DrainPersonRow,
  FbCatRow, FbCategory, FbNightRow, FbVenueRow, Flag, HourRow, LoanMonthRow, LoanProductRow, MonthRow, ParseResult,
  PayeeRow, PayeeType, PersonRow, Settings, Txn, TxnCat,
} from './types';
import { BET, CRB, FB_CATS, MICRO, classifyPayee, intComma, ksh, kshShort, payeeName, personKey, pyRound, pyTitle, venueName } from './classify';
import { DOW, monthRange, parts, weekdayOfDate, type LocalParts } from './time';

const OUT: Partial<Record<TxnCat, string>> = {
  send_person: 'Sent to people', send_pochi: 'Sent to people', send_paybill: 'Paybill', till: 'Till / Buy Goods',
  withdraw: 'Agent withdrawal', airtime: 'Airtime', kcb_to: 'To KCB M-PESA', mshwari_to: 'To M-Shwari',
  kcb_repay: 'KCB M-PESA loan repayment', hustler_repay: 'Hustler Fund repayment', fuliza_repay: 'Fuliza repayment',
};
const IN: Partial<Record<TxnCat, string>> = {
  recv_person: 'From people', recv_business: 'From banks & businesses', kcb_from: 'From KCB M-PESA',
  mshwari_from: 'From M-Shwari', reversal: 'Reversals', deposit: 'Cash deposits at agent',
};
const DAY = 86400e3;
const r2 = (x: number) => pyRound(x, 2);
const r1 = (x: number) => pyRound(x, 1);
const r0 = (x: number) => pyRound(x);
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const isSend = (c: TxnCat) => c === 'send_person' || c === 'send_pochi';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Txn with precomputed Nairobi-time fields. t = epoch ms floored to the second. */
interface T extends Txn { t: number; p: LocalParts; night: LocalParts }

/** Counter.most_common semantics: sort by value desc, ties keep insertion order. */
function mostCommon<K>(m: Map<K, number>, n = Infinity): [K, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
const inc = <K>(m: Map<K, number>, k: K, v = 1) => m.set(k, (m.get(k) ?? 0) + v);
const minS = (a: string | null, b: string) => (a === null || b < a ? b : a);
const maxS = (a: string | null, b: string) => (a === null || b > a ? b : a);
/** Join "a, b and c". */
const andList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const plural = (n: number, w: string) => `${intComma(n)} ${w}${n === 1 ? '' : 's'}`;

export function analyze(pr: ParseResult, settings: Settings): Analysis {
  const excluded = new Set(settings.excludedPeople.map(personKey));
  const extraBars = new Set(settings.extraBars.map((s) => payeeName(s.replace(/^(Paybill|Till \/ Buy Goods)\|/, '')).toUpperCase()));
  const tx: T[] = pr.txns.map((x) => {
    const t = Math.floor(x.ts / 1000) * 1000;
    return { ...x, t, p: parts(t), night: parts(t - 5 * 3600e3) };
  });
  if (!tx.length) throw new Error('No M-PESA transactions found in this backup.');

  const firstDate = tx.reduce((a, r) => (r.p.date < a ? r.p.date : a), tx[0].p.date);
  const lastDate = tx.reduce((a, r) => (r.p.date > a ? r.p.date : a), tx[0].p.date);
  const months = monthRange(firstDate.slice(0, 7), lastDate.slice(0, 7));
  const outs = tx.filter((r) => OUT[r.cat]);
  const fd = tx.filter((r) => r.cat === 'fuliza_draw');
  const biz = tx.filter((r) => r.cat === 'send_paybill' || r.cat === 'till');
  const END = Math.max(...tx.map((r) => r.t));
  const Y1 = END - 365 * DAY, Y2 = END - 730 * DAY, D90 = END - 90 * DAY;

  // ---------- monthly / categories / hours (build.py) ----------
  const mon = new Map(months.map((m) => [m, { in: 0, out: 0, fuliza: 0, fn: 0, fee: 0, cost: 0 }]));
  const cat = new Map<string, { dir: 'In' | 'Out'; label: string; amt: number; n: number }>();
  const hrs = Array.from({ length: 24 }, () => ({ n: 0, amt: 0 }));
  const addCat = (dir: 'In' | 'Out', label: string, amt: number) => {
    const k = dir + '|' + label;
    const c = cat.get(k) ?? cat.set(k, { dir, label, amt: 0, n: 0 }).get(k)!;
    c.amt += amt; c.n++;
  };
  for (const r of tx) {
    const m = mon.get(r.p.month)!;
    const o = OUT[r.cat], i = IN[r.cat];
    if (o) { m.out += r.amount; addCat('Out', o, r.amount); hrs[r.p.hour].n++; hrs[r.p.hour].amt += r.amount; }
    if (i) { m.in += r.amount; addCat('In', i, r.amount); }
    if (r.cat === 'fuliza_draw') { m.fuliza += r.amount; m.fn++; m.fee += r.fee ?? 0; }
    m.cost += r.cost;
  }
  const monthly: MonthRow[] = months.map((k) => {
    const m = mon.get(k)!;
    return { month: k, money_in: r2(m.in), money_out: r2(m.out), net: r2(m.in - m.out), fuliza: r2(m.fuliza), fuliza_draws: m.fn, fuliza_fees: r2(m.fee), tx_cost: r2(m.cost) };
  });
  const categories: CategoryRow[] = [...cat.values()].sort((a, b) => b.amt - a.amt)
    .map((c) => ({ direction: c.dir, category: c.label, amount: r2(c.amt), count: c.n }));
  const hours: HourRow[] = hrs.map((h, hour) => ({ hour, count: h.n, amount: r2(h.amt) }));

  // ---------- people (agg.py) ----------
  type PAgg = { name: string; sent: number; sn: number; recv: number; rn: number; phones: Set<string>; cost: number; first: string | null; last: string | null };
  const P = new Map<string, PAgg>();
  for (const r of tx) {
    if (!isSend(r.cat) && r.cat !== 'recv_person') continue;
    const k = personKey(r.name ?? '');
    const p = P.get(k) ?? P.set(k, { name: k, sent: 0, sn: 0, recv: 0, rn: 0, phones: new Set(), cost: 0, first: null, last: null }).get(k)!;
    if (r.cat === 'recv_person') { p.recv += r.amount; p.rn++; } else { p.sent += r.amount; p.sn++; p.cost += r.cost; }
    if (r.phone) p.phones.add(r.phone);
    p.first = minS(p.first, r.p.date); p.last = maxS(p.last, r.p.date);
  }
  const showPhones = (ph: Set<string>) => {
    const all = [...ph], full = all.filter((x) => !x.includes('*'));
    return (full.length ? full : all).sort().slice(0, 2).join(', ');
  };
  const people: PersonRow[] = [...P.values()].map((p) => ({
    name: p.name, phone: showPhones(p.phones), sent: r2(p.sent), sent_n: p.sn, recv: r2(p.recv), recv_n: p.rn,
    net: r2(p.recv - p.sent), cost: r2(p.cost), first: p.first ?? '', last: p.last ?? '',
  })).sort((a, b) => b.sent - a.sent);

  // ---------- payees (biz100.py) ----------
  type BAgg = { name: string; type: PayeeType; amt: number; n: number; cost: number; accts: Map<string, number>; first: string | null; last: string | null };
  const B = new Map<string, BAgg>();
  for (const r of biz) {
    const nm = payeeName(r.name ?? '');
    const type: PayeeType = r.cat === 'send_paybill' ? 'Paybill' : 'Till / Buy Goods';
    const k = nm.toUpperCase() + '|' + type;
    const b = B.get(k) ?? B.set(k, { name: nm, type, amt: 0, n: 0, cost: 0, accts: new Map(), first: null, last: null }).get(k)!;
    b.amt += r.amount; b.n++; b.cost += r.cost;
    if (r.account) inc(b.accts, r.account);
    b.first = minS(b.first, r.p.date); b.last = maxS(b.last, r.p.date);
  }
  const payees: PayeeRow[] = [...B.values()].sort((a, b) => b.amt - a.amt).map((b) => ({
    key: `${b.type}|${b.name}`, name: b.name, type: b.type, amount: r2(b.amt), count: b.n, avg: r2(b.amt / b.n), cost: r2(b.cost),
    top_account: b.accts.size ? mostCommon(b.accts, 1)[0][0] : '', first: b.first ?? '', last: b.last ?? '',
  }));

  // ---------- when you pay businesses (biztime.py) ----------
  const z = () => ({ pb_amt: 0, pb_n: 0, till_amt: 0, till_n: 0, amt: 0, n: 0 });
  const dow = Array.from({ length: 7 }, z), hr = Array.from({ length: 24 }, z), grid = Array.from({ length: 168 }, z);
  const dayTopM = Array.from({ length: 7 }, () => new Map<string, number>());
  for (const r of biz) {
    const pb = r.cat === 'send_paybill', d = r.p.weekday, h = r.p.hour;
    for (const D of [dow[d], hr[h], grid[d * 24 + h]]) {
      if (pb) { D.pb_amt += r.amount; D.pb_n++; } else { D.till_amt += r.amount; D.till_n++; }
      D.amt += r.amount; D.n++;
    }
    inc(dayTopM[d], (r.name ?? '').trim().replace(/\.+$/, ''), r.amount);
  }
  const bizDow: BizDowRow[] = dow.map((x, d) => ({ day: DOW[d], day_no: d + 1, paybill: r0(x.pb_amt), till: r0(x.till_amt), total: r0(x.amt), paybill_n: x.pb_n, till_n: x.till_n, count: x.n, avg: x.n ? r0(x.amt / x.n) : 0 }));
  const bizHour: BizHourRow[] = hr.map((x, h) => ({ hour: h, paybill: r0(x.pb_amt), till: r0(x.till_amt), total: r0(x.amt), count: x.n, avg: x.n ? r0(x.amt / x.n) : 0 }));
  const bizGrid: BizGridRow[] = grid.map((x, i) => ({ day: DOW[Math.floor(i / 24)], day_no: Math.floor(i / 24) + 1, hour: i % 24, total: r0(x.amt), count: x.n }));
  const PARTS: [string, number, number][] = [['Early morning 00–05', 0, 5], ['Morning 05–12', 5, 12], ['Afternoon 12–17', 12, 17], ['Evening 17–21', 17, 21], ['Night 21–24', 21, 24]];
  const partRows = PARTS.map(([part, a, b]) => {
    const s = biz.filter((r) => r.p.hour >= a && r.p.hour < b);
    return { part, total: r0(sum(s, (r) => r.amount)), count: s.length, paybill: r0(sum(s.filter((r) => r.cat === 'send_paybill'), (r) => r.amount)), till: r0(sum(s.filter((r) => r.cat === 'till'), (r) => r.amount)), share: 0 };
  });
  const partTot = sum(partRows, (p) => p.total);
  const bizParts: BizPartRow[] = partRows.map((p) => ({ ...p, share: partTot ? r1((100 * p.total) / partTot) : 0 }));
  const dayTop: BizDayTopRow[] = dayTopM.flatMap((m, d) => mostCommon(m, 3).map(([name, a], i) => ({ key: `${DOW[d]}-${i + 1}`, day: DOW[d], rank: i + 1, name, amount: r0(a) })));

  // ---------- food & bars (bars.py) ----------
  type FbTx = T & { venue: string; cls: FbCategory };
  const fbRows: FbTx[] = [];
  for (const r of biz) {
    const n = payeeName(r.name ?? ''), c = classifyPayee(n, extraBars);
    if (c) fbRows.push({ ...r, venue: venueName(n), cls: c });
  }
  const isLate = (h: number) => h < 5 || h >= 22;
  const V = new Map<string, { venue: string; category: FbCategory; amount: number; visits: number; first: string | null; last: string | null; late: number }>();
  for (const r of fbRows) {
    const k = r.venue.toUpperCase();
    const v = V.get(k) ?? V.set(k, { venue: r.venue, category: r.cls, amount: 0, visits: 0, first: null, last: null, late: 0 }).get(k)!;
    v.amount += r.amount; v.visits++; v.first = minS(v.first, r.p.date); v.last = maxS(v.last, r.p.date);
    if (isLate(r.p.hour)) v.late++;
  }
  const venues: FbVenueRow[] = [...V.values()].sort((a, b) => b.amount - a.amount).slice(0, 100).map((v, i) => ({
    rank: i + 1, venue: v.venue, category: v.category, amount: r0(v.amount), visits: v.visits, avg: r0(v.amount / v.visits), late: v.late, first: v.first ?? '', last: v.last ?? '',
  }));
  const ci = (c: FbCategory) => FB_CATS.indexOf(c);
  const series = () => ({ c: [0, 0, 0], n: 0 });
  const sRow = (s: { c: number[] }) => ({ bars: r0(s.c[0]), food: r0(s.c[1]), meat: r0(s.c[2]), total: r0(s.c[0] + s.c[1] + s.c[2]) });
  const FM = new Map(months.map((m) => [m, series()]));
  const FD = Array.from({ length: 7 }, series), FH = Array.from({ length: 24 }, series);
  const FY = new Map<number, ReturnType<typeof series>>();
  for (const r of fbRows) {
    const k = ci(r.cls);
    for (const s of [FM.get(r.p.month)!, FD[r.night.weekday], FH[r.p.hour], FY.get(r.p.year) ?? FY.set(r.p.year, series()).get(r.p.year)!]) { s.c[k] += r.amount; s.n++; }
  }
  const fbCats: FbCatRow[] = FB_CATS.map((c) => {
    const s = fbRows.filter((r) => r.cls === c), tot = sum(s, (r) => r.amount);
    return {
      category: c, amount: r0(tot), payments: s.length, venues: new Set(s.map((r) => r.venue.toUpperCase())).size,
      avg: s.length ? r0(tot / s.length) : 0,
      weekend_pct: tot ? r1((100 * sum(s.filter((r) => r.p.weekday >= 5), (r) => r.amount)) / tot) : 0,
      late_pct: tot ? r1((100 * sum(s.filter((r) => isLate(r.p.hour)), (r) => r.amount)) / tot) : 0,
    };
  });
  // Bar nights: the "night" is the calendar date 5 hours earlier, so 01:00 Sunday belongs to Saturday night.
  const N = new Map<string, { amount: number; n: number; venues: Map<string, number> }>();
  for (const r of fbRows) {
    if (r.cls !== 'Bars & lounges') continue;
    const k = r.night.date;
    const x = N.get(k) ?? N.set(k, { amount: 0, n: 0, venues: new Map() }).get(k)!;
    x.amount += r.amount; x.n++; inc(x.venues, r.venue, r.amount);
  }
  const nightsAll = [...N.entries()].sort((a, b) => b[1].amount - a[1].amount);
  const nights: FbNightRow[] = nightsAll.slice(0, 15).map(([k, v]) => ({
    night: k, day: DOW[weekdayOfDate(k)], amount: r0(v.amount), payments: v.n, venues: mostCommon(v.venues, 3).map(([x]) => x).join(', '),
  }));
  const tillTotal = sum(tx.filter((r) => r.cat === 'till'), (r) => r.amount);
  const fbTot = sum(fbRows, (r) => r.amount);
  const fb: Analysis['fb'] = {
    summary: {
      total: r0(fbTot), payments: fbRows.length, venues: V.size, bars: fbCats[0].amount, food: fbCats[1].amount, meat: fbCats[2].amount,
      per_month: r0(fbTot / months.length), share_of_till: tillTotal ? r1((100 * sum(fbRows.filter((r) => r.cat === 'till'), (r) => r.amount)) / tillTotal) : 0,
      bar_nights: N.size, biggest_night: nightsAll.length ? r0(nightsAll[0][1].amount) : 0,
    },
    cats: fbCats, venues,
    yearly: [...FY.entries()].sort((a, b) => a[0] - b[0]).map(([year, s]) => ({ year, ...sRow(s), payments: s.n })),
    dow: FD.map((s, d) => ({ day: DOW[d], day_no: d + 1, ...sRow(s), count: s.n })),
    hour: FH.map((s, h) => ({ hour: h, ...sRow(s), count: s.n })),
    monthly: months.map((m) => ({ month: m, ...sRow(FM.get(m)!) })),
    nights,
  };

  // ---------- drains: people (drains.py) ----------
  type DAgg = { sent: number; recv: number; sn: number; rn: number; s12: number; sPrev: number; maxs: number; s90: number; months: Set<string>; phones: Set<string>; firstSend: number; lastSend: number };
  const DP = new Map<string, DAgg>();
  for (const r of tx) {
    if (!isSend(r.cat) && r.cat !== 'recv_person') continue;
    const nm = personKey(r.name ?? '');
    if (excluded.has(nm)) continue;
    const p = DP.get(nm) ?? DP.set(nm, { sent: 0, recv: 0, sn: 0, rn: 0, s12: 0, sPrev: 0, maxs: 0, s90: 0, months: new Set(), phones: new Set(), firstSend: Infinity, lastSend: -Infinity }).get(nm)!;
    if (r.phone && !r.phone.includes('*')) p.phones.add(r.phone);
    if (r.cat === 'recv_person') { p.recv += r.amount; p.rn++; }
    else {
      p.sent += r.amount; p.sn++; p.maxs = Math.max(p.maxs, r.amount); p.months.add(r.p.month);
      p.firstSend = Math.min(p.firstSend, r.t); p.lastSend = Math.max(p.lastSend, r.t);
      if (r.t >= Y1) p.s12 += r.amount; else if (r.t >= Y2) p.sPrev += r.amount;
      if (r.t >= D90) p.s90++;
    }
  }
  const drainPeopleAll = [...DP.entries()].filter(([, p]) => p.sent - p.recv >= 10000).map(([nm, p]) => {
    const tags: string[] = [];
    const rising = p.s12 > p.sPrev * 1.5 && p.s12 >= 10000;
    if (p.recv === 0) tags.push('Never sent anything back');
    else if (p.recv / p.sent < 0.25) tags.push(`Returned only ${r0((100 * p.recv) / p.sent)}%`);
    if (p.maxs >= 20000) tags.push(`Single send of ${ksh(p.maxs)}`);
    if (p.sn >= 30) tags.push(`${p.sn} separate sends`);
    if (rising) tags.push('Rising in last 12 months');
    if (p.s90 >= 5) tags.push(`${p.s90} sends in last 90 days`);
    const row: DrainPersonRow = {
      rank: 0, name: pyTitle(nm), phone: [...p.phones].sort().slice(0, 2).join(', '), net_out: r0(p.sent - p.recv), sent: r0(p.sent), sends: p.sn,
      received: r0(p.recv), returned_pct: r1((100 * p.recv) / p.sent), sent_12m: r0(p.s12), sent_prev_12m: r0(p.sPrev), largest_send: r0(p.maxs),
      months_active: p.months.size, flags: tags.join(' · '),
    };
    return { row, agg: p, rising };
  }).sort((a, b) => b.row.net_out - a.row.net_out);
  drainPeopleAll.forEach((x, i) => (x.row.rank = i + 1));

  // ---------- drains: bars ----------
  const DB = new Map<string, { amt: number; n: number; a12: number; aprev: number; late: number; afterMid: number; n90: number; late12: number; nights: Map<string, number> }>();
  for (const r of fbRows) {
    if (r.cls !== 'Bars & lounges') continue;
    const b = DB.get(r.venue) ?? DB.set(r.venue, { amt: 0, n: 0, a12: 0, aprev: 0, late: 0, afterMid: 0, n90: 0, late12: 0, nights: new Map() }).get(r.venue)!;
    b.amt += r.amount; b.n++;
    if (r.t >= Y1) { b.a12 += r.amount; if (r.p.hour >= 22 || r.p.hour < 5) b.late12 += r.amount; } else if (r.t >= Y2) b.aprev += r.amount;
    if (r.p.hour >= 22 || r.p.hour < 5) b.late += r.amount;
    if (r.p.hour < 5) b.afterMid += r.amount;
    if (r.t >= D90) b.n90++;
    inc(b.nights, r.night.date, r.amount);
  }
  const drainBarsAll: DrainBarRow[] = [...DB.entries()].map(([venue, b]) => {
    const big = Math.max(...b.nights.values()), tags: string[] = [];
    if (b.a12 > b.aprev * 1.5 && b.a12 >= 5000) tags.push(b.aprev ? 'Spending rising' : 'New in last 12 months');
    if (b.late / b.amt >= 0.5) tags.push(`${r0((100 * b.late) / b.amt)}% after 10 PM`);
    if (b.afterMid >= 5000) tags.push(`${ksh(b.afterMid)} after midnight`);
    if (big >= 8000) tags.push(`One night: ${ksh(big)}`);
    if (b.n90 >= 5) tags.push(`${b.n90} payments in last 90 days`);
    return {
      rank: 0, venue, total: r0(b.amt), payments: b.n, nights: b.nights.size, per_night: r0(b.amt / b.nights.size), last_12m: r0(b.a12), prev_12m: r0(b.aprev),
      late_pct: r1((100 * b.late) / b.amt), biggest_night: r0(big), flags: tags.join(' · '),
    };
  }).sort((a, b) => b.total - a.total);
  drainBarsAll.forEach((r, i) => (r.rank = i + 1));

  // ---------- loans (loans.py) ----------
  const LM = new Map(months.map((m) => [m, { fuliza: 0, fees: 0, fn: 0, frep: 0, kreq: 0, krep: 0, hin: 0, hrep: 0 }]));
  const isHustlerIn = (r: T) => r.cat === 'recv_business' && (r.name ?? '').startsWith('Hustler');
  for (const r of tx) {
    const m = LM.get(r.p.month)!;
    if (r.cat === 'fuliza_draw') { m.fuliza += r.amount; m.fees += r.fee ?? 0; m.fn++; }
    else if (r.cat === 'fuliza_repay') m.frep += r.amount;
    else if (r.cat === 'kcb_repay') m.krep += r.amount;
    else if (r.cat === 'hustler_repay') m.hrep += r.amount;
    else if (isHustlerIn(r)) m.hin += r.amount;
  }
  for (const ts of pr.kcbLoanRequestTs ?? []) { const m = LM.get(parts(ts).month); if (m) m.kreq++; }
  const loansMonthly: LoanMonthRow[] = months.map((k) => {
    const m = LM.get(k)!;
    return { month: k, fuliza: r0(m.fuliza), fuliza_draws: m.fn, fuliza_fees: r2(m.fees), fuliza_repaid: r0(m.frep), kcb_requests: m.kreq, kcb_repaid: r0(m.krep), hustler_in: r0(m.hin), hustler_repaid: r0(m.hrep) };
  });
  const span = (xs: T[]) => (xs.length ? [xs.reduce((a, r) => (r.p.date < a ? r.p.date : a), xs[0].p.date), xs.reduce((a, r) => (r.p.date > a ? r.p.date : a), xs[0].p.date)] : ['', '']);
  const frep = tx.filter((r) => r.cat === 'fuliza_repay'), krep = tx.filter((r) => r.cat === 'kcb_repay');
  const hin = tx.filter(isHustlerIn), hrep = tx.filter((r) => r.cat === 'hustler_repay');
  const fees = sum(fd, (r) => r.fee ?? 0);
  const products: LoanProductRow[] = [
    { product: 'Fuliza M-PESA', borrowed: r0(sum(fd, (r) => r.amount)), borrow_count: fd.length, repaid: r0(sum(frep, (r) => r.amount)), repay_count: frep.length, fees: r0(fees), first: span(fd)[0], last: span(fd)[1], note: 'Access fees only; daily charges not in SMS' },
    { product: 'KCB M-PESA loan', borrowed: null, borrow_count: pr.counters.kcbLoanRequests, repaid: r0(sum(krep, (r) => r.amount)), repay_count: krep.length, fees: null, first: span(krep)[0], last: span(krep)[1], note: 'Loan amounts not in SMS; count is loan requests' },
    { product: 'Hustler Fund', borrowed: r0(sum(hin, (r) => r.amount)), borrow_count: hin.length, repaid: r0(sum(hrep, (r) => r.amount)), repay_count: hrep.length, fees: null, first: span([...hin, ...hrep])[0], last: span([...hin, ...hrep])[1], note: '' },
  ];

  // ---------- summary ----------
  const totIn = sum(months, (m) => mon.get(m)!.in), totOut = sum(months, (m) => mon.get(m)!.out);
  const totCost = sum(tx, (r) => r.cost);
  const sends = tx.filter((r) => isSend(r.cat));
  const sentToPeople = sum(sends, (r) => r.amount);
  const summary = {
    first: firstDate, last: lastDate, transactions: tx.filter((r) => OUT[r.cat] || IN[r.cat]).length,
    money_in: r0(totIn), money_out: r0(totOut), fuliza: r0(sum(fd, (r) => r.amount)), tx_cost: r0(totCost),
    people_sent: r0(sentToPeople), paybill_till: r0(sum(biz, (r) => r.amount)),
  };

  // ---------- flags (build.py + flags2.py), every number computed ----------
  const flags: Flag[] = [];
  const lastYear = Number(lastDate.slice(0, 4));
  const exclNote = excluded.size ? ' People you excluded in Settings are left out.' : '';

  // fuliza
  const fm = new Map<string, number>();
  for (const r of fd) inc(fm, r.p.month);
  const peak = mostCommon(fm, 1)[0];
  flags.push({ id: 'fuliza', severity: 'High', title: 'Heavy Fuliza dependence', value: fd.length, unit: 'overdraft draws',
    detail: fd.length
      ? `${ksh(summary.fuliza)} borrowed via Fuliza in ${fm.size} of ${months.length} months; peak ${peak[0]} with ${peak[1]} draws. Access fees alone were ${ksh(fees)} (daily charges are not in the SMSes, so the real cost is higher).`
      : 'No Fuliza overdraft draws found.' });

  // zero balance after outgoing payments
  const zb = outs.filter((r) => r.balance !== null), zc = zb.filter((r) => (r.balance as number) <= 0.01).length;
  flags.push({ id: 'zero', severity: 'High', title: 'Wallet frequently drained to zero', value: zb.length ? r1((100 * zc) / zb.length) : 0, unit: '% of payments left KSh 0',
    detail: `${intComma(zc)} of ${intComma(zb.length)} outgoing payments left your M-PESA balance at KSh 0 — usually a sign that money runs out between inflows and Fuliza fills the gap.` });

  // loans
  flags.push({ id: 'loans', severity: 'High', title: 'Recurring digital borrowing', value: pr.counters.kcbLoanRequests, unit: 'KCB M-PESA loan requests',
    detail: `${ksh(sum(krep, (r) => r.amount))} repaid to KCB M-PESA loans; Hustler Fund: ${ksh(sum(hin, (r) => r.amount))} borrowed, ${ksh(sum(hrep, (r) => r.amount))} repaid. Fuliza repayments add ${ksh(sum(frep, (r) => r.amount))}.` });

  // bars rising: last 12 months vs the 12 before
  const bars = [...DB.entries()];
  const s12 = sum(bars, ([, b]) => b.a12), sPrev = sum(bars, ([, b]) => b.aprev), late12 = sum(bars, ([, b]) => b.late12);
  const barChange = sPrev ? r0(100 * (s12 / sPrev - 1)) : s12 ? 100 : 0;
  const shortVenue = (v: string) => pyTitle(v.replace(/\s*\(all tills\)/i, '').replace(/\s+(LIMITED|LTD)\.?$/i, ''));
  const topBars = bars.filter(([, b]) => b.a12 > 0).sort((a, b) => b[1].a12 - a[1].a12).slice(0, 3)
    .map(([v, b], i) => `${shortVenue(v)} (${kshShort(b.a12)}${i === 0 ? ' this year' : ''}${b.aprev === 0 ? ', new this year' : ''})`);
  const lateShare = s12 ? late12 / s12 : 0;
  flags.push({ id: 'bars_rising', severity: 'High',
    title: barChange >= 50 ? 'Bar & club spending is climbing fast' : barChange > 0 ? 'Bar & club spending is rising' : 'Bar & club spending',
    value: barChange, unit: barChange >= 0 ? '% more than the year before' : '% change vs the year before',
    detail: `${ksh(s12)} at bars and lounges in the last 12 months vs ${ksh(sPrev)} in the 12 months before.` +
      (topBars.length ? ` ${andList(topBars)} lead it, and ${lateShare >= 0.5 ? 'most' : `${r0(100 * lateShare)}%`} of it is paid after 10 PM.` : '') });

  // one-way: drain list people who never sent anything back
  const ow = drainPeopleAll.filter((x) => x.agg.recv === 0);
  const owTotal = sum(ow, (x) => x.agg.sent);
  const histYears = Math.max(1, r0((Date.parse(lastDate) - Date.parse(firstDate)) / (365.25 * DAY)));
  const monLabel = (t: number) => { const p = parts(t); return { m: MON[Number(p.month.slice(5)) - 1], y: p.year }; };
  const recentSpan = (a: DAgg) => {
    if (a.firstSend < D90) return '';
    const f = monLabel(a.firstSend), l = monLabel(a.lastSend);
    return f.m === l.m && f.y === l.y ? ` (${l.m} ${l.y})` : f.y === l.y ? ` (${f.m}–${l.m} ${l.y})` : ` (${f.m} ${f.y}–${l.m} ${l.y})`;
  };
  flags.push({ id: 'oneway', severity: 'High', title: 'Money sent to people who never send back', value: ow.length, unit: 'people (KSh 10k+ each, nothing returned)',
    detail: `${ow.length} people have received KSh 10,000+ from you and never sent anything back — ${kshShort(owTotal)} in total (this list covers the whole ${histYears}-year history, so some may be your own savings or family support).` +
      (ow.length ? ` Largest: ${ow.slice(0, 5).map((x) => `${x.row.name} ${kshShort(x.agg.sent)}${recentSpan(x.agg)}`).join(', ')}.` : '') + exclNote });

  // borrow to give: Fuliza draws that funded a send-money/Pochi payment (same transaction code)
  const sendByCode = new Map<string, T>();
  for (const r of sends) if (!sendByCode.has(r.code)) sendByCode.set(r.code, r);
  const bg = fd.filter((r) => { const s = sendByCode.get(r.code); return s && !excluded.has(personKey(s.name ?? '')); });
  const bgAmt = sum(bg, (r) => r.amount);
  flags.push({ id: 'borrow_give', severity: 'High', title: 'Borrowing on Fuliza to give money away', value: r0(bgAmt), unit: 'KSh of Fuliza used to send to people',
    detail: `${kshShort(bgAmt)} of Fuliza overdraft went straight into send-money and Pochi payments to people (${plural(bg.length, 'transfer')}). You paid ${ksh(sum(bg, (r) => r.fee ?? 0))} in access fees on money you then gave out.${exclNote}` });

  // overspend months
  const neg = months.filter((m) => mon.get(m)!.out > mon.get(m)!.in);
  const gap = (m: string) => mon.get(m)!.out - mon.get(m)!.in;
  const worst = neg.reduce<string | null>((a, m) => (a === null || gap(m) > gap(a) ? m : a), null);
  flags.push({ id: 'overspend', severity: 'Medium', title: 'Months where spending beat income', value: neg.length, unit: `of ${months.length} months`,
    detail: worst ? `Money out exceeded money in during ${neg.length} months, worst ${worst} (short by ${ksh(gap(worst))}). Gaps were bridged with Fuliza and loans.` : 'Money in covered money out every month.' });

  // transaction costs
  flags.push({ id: 'cost', severity: 'Medium', title: 'Fees paid to Safaricom', value: r0(totCost), unit: 'KSh in transaction costs',
    detail: `${ksh(totCost)} total transaction charges, ${ksh(sum(sends, (r) => r.cost))} of it on send-money. Fewer, larger transfers cost less per shilling than many small ones.` });

  // frequent askers: ≥40 sends, still active (≥5 sends in last 90 days or rising), and got back < 60%
  const freq = drainPeopleAll.filter((x) => x.agg.sn >= 40 && (x.agg.s90 >= 5 || x.rising) && x.agg.recv / x.agg.sent < 0.6);
  flags.push({ id: 'frequent', severity: 'Medium', title: 'People who ask often', value: freq.length, unit: 'people with frequent small sends',
    detail: freq.length ? andList(freq.map((x) => {
      const bits = [`${x.agg.sn} sends`, `${r0(x.row.returned_pct)}% returned`, `net ${kshShort(x.row.net_out)} out`];
      bits.push(x.agg.s90 >= 5 ? `${x.agg.s90} in the last 90 days` : 'rising this year');
      return `${x.row.name} (${bits.join(', ')})`;
    })) + '.' : 'Nobody you send to often (40+ sends) is still asking regularly.' });

  // micro bundles
  const micro = tx.filter((r) => r.cat === 'send_paybill' && MICRO.test(r.name ?? ''));
  const microAmt = sum(micro, (r) => r.amount);
  flags.push({ id: 'micro', severity: 'Low', title: 'Many tiny bundle purchases', value: micro.length, unit: 'bundle/Tunukiwa purchases',
    detail: micro.length ? `${ksh(microAmt)} on Safaricom bundles across ${intComma(micro.length)} purchases (avg ${ksh(microAmt / micro.length)}). A monthly plan is usually cheaper.` : 'No Safaricom bundle purchases via paybill.' });

  // late night
  const night = outs.filter((r) => r.p.hour < 5);
  flags.push({ id: 'night', severity: 'Low', title: 'Late-night spending', value: night.length, unit: 'payments 00:00–04:59',
    detail: `${ksh(sum(night, (r) => r.amount))} sent between midnight and 5 AM.` });

  // failed
  const c = pr.counters;
  flags.push({ id: 'failed', severity: 'Low', title: 'Failed & blocked transactions', value: c.insufficientFunds, unit: 'insufficient-funds failures',
    detail: `${c.insufficientFunds} failures for insufficient funds, ${c.wrongPin} wrong-PIN attempts and ${c.pinLocked} PIN/account lockouts.` });

  // betting
  const bo = biz.filter((r) => BET.test(r.name ?? '')), bi = tx.filter((r) => r.cat === 'recv_business' && BET.test(r.name ?? ''));
  const boAmt = sum(bo, (r) => r.amount), biAmt = sum(bi, (r) => r.amount);
  const brands = [...new Set(bo.map((r) => pyTitle((r.name ?? '').match(BET)![0])))];
  const recentBets = bo.filter((r) => r.p.year >= lastYear - 1).length;
  flags.push({ id: 'betting', severity: 'Low', title: bo.length && recentBets <= bo.length * 0.1 ? 'Betting (mostly stopped)' : 'Betting', value: bo.length, unit: 'bets placed',
    detail: bo.length ? `${ksh(boAmt)} staked on ${andList(brands)} vs ${ksh(biAmt)} won — net ${ksh(biAmt - boAmt)}. ${recentBets} bets since ${lastYear - 1}.` : 'No betting payments found.' });

  // credit bureaus
  const crb = tx.filter((r) => r.cat === 'send_paybill' && CRB.test(r.name ?? ''));
  flags.push({ id: 'crb', severity: 'Low', title: 'Credit bureau payments', value: r0(sum(crb, (r) => r.amount)), unit: 'KSh paid to CRBs',
    detail: `${crb.length} payments to credit reference bureaus — worth checking your CRB status is clean.` });

  // withdrawal fees
  const wd = tx.filter((r) => r.cat === 'withdraw'), wdCost = sum(wd, (r) => r.cost);
  flags.push({ id: 'withdraw', severity: 'Low', title: 'Agent withdrawal fees', value: r0(wdCost), unit: 'KSh in withdrawal charges',
    detail: `${wd.length} cash withdrawals cost ${ksh(wdCost)} in fees. Paying the till or paybill directly avoids this.` });

  // reversals
  const rv = tx.filter((r) => r.cat === 'reversal');
  flags.push({ id: 'reversal', severity: 'Low', title: 'Sent to the wrong number', value: rv.length, unit: 'reversals',
    detail: `${rv.length} transactions had to be reversed, ${rv.filter((r) => r.p.year === lastYear).length} of them in ${lastYear}. A sign of rushed sends; check names on the confirmation before you enter your PIN.` });

  const order = { High: 0, Medium: 1, Low: 2 };
  flags.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    summary, flags, monthly, categories, hours, people, payees,
    biz: { dow: bizDow, hour: bizHour, grid: bizGrid, parts: bizParts, dayTop },
    fb,
    drains: { bars: drainBarsAll.slice(0, 20), people: drainPeopleAll.map((x) => x.row) },
    loans: { monthly: loansMonthly, products },
  };
}
