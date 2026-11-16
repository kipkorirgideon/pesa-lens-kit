// Shared data contract between the parser (src/lib/parse.ts, src/lib/analyze.ts) and the UI.
// All money values are KSh numbers. All dates are ISO strings in Africa/Nairobi time (UTC+3).

/** Raw backup file shape (SMS Backup app export): { listSms: RawSms[] } */
export interface RawSms {
  adress: string;
  body: string;
  name?: string;
  time: number;
  type?: number;
}

export type TxnCat =
  | 'send_person'
  | 'send_pochi'
  | 'send_paybill'
  | 'till'
  | 'recv_person'
  | 'recv_business'
  | 'withdraw'
  | 'deposit'
  | 'airtime'
  | 'fuliza_draw'
  | 'fuliza_repay'
  | 'kcb_from'
  | 'kcb_to'
  | 'kcb_repay'
  | 'mshwari_from'
  | 'mshwari_to'
  | 'hustler_repay'
  | 'reversal';

/** One de-duplicated M-PESA transaction (dedupe key: cat + code). */
export interface Txn {
  code: string; // e.g. UKGMC23RX7 (upper-case)
  cat: TxnCat;
  ts: number; // epoch ms (from the SMS `time` field)
  iso: string; // 'YYYY-MM-DDTHH:mm' Nairobi local time
  amount: number;
  cost: number; // "Transaction cost" if present, else 0
  balance: number | null; // "New M-PESA balance" if present
  name?: string; // counterparty as written in the SMS
  phone?: string; // full or masked (0727***224) phone if present
  account?: string; // paybill account number
  fee?: number; // Fuliza access/interest fee
  orig?: string; // reversed transaction code
}

export interface ParseResult {
  txns: Txn[];
  /**
   * Counts of non-transaction messages useful for red flags. `insufficientFunds`, `wrongPin`, `pinLocked` and
   * `kcbLoanRequests` count M-PESA-sender messages only (`adress` MPESA / M-PESA, see `isMpesaSender`).
   * `totalSms` is the number of messages in the file (`listSms.length`), whatever their sender; it is a file-level
   * figure, not the number of messages that were considered.
   */
  counters: { insufficientFunds: number; wrongPin: number; pinLocked: number; kcbLoanRequests: number; totalSms: number };
  /** Optional (added by parser): SMS `time` (epoch ms) of each distinct KCB M-PESA loan request, for loans.monthly.kcb_requests. */
  kcbLoanRequestTs?: number[];
}

export interface Settings {
  /** Upper-cased, space-collapsed person names excluded from red flags & drain lists (still shown in people tables). */
  excludedPeople: string[];
  /** Payee names (as shown in payee tables) the user has manually tagged as bars/lounges. */
  extraBars: string[];
  /** Plain-text payee names/prefixes (case-insensitive) forced to Restaurants & food. Never a RegExp. */
  extraFood: string[];
  /** Merge several tills of one venue: a payee name starting with `match` (case-insensitive) is shown as `name`. Never a RegExp. */
  venueMerges: { match: string; name: string }[];
}
/** No personal defaults ship in the bundle; everything is user-entered and stored locally. */
export const DEFAULT_SETTINGS: Settings = deepFreeze({ excludedPeople: [], extraBars: [], extraFood: [], venueMerges: [] });

/** Recursively freezes arrays/objects so a shared module-level constant can never be mutated by a caller. */
function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o as Record<string, unknown>).forEach(deepFreeze);
  }
  return o;
}

export interface Summary {
  first: string;
  last: string;
  transactions: number;
  money_in: number;
  money_out: number;
  fuliza: number;
  tx_cost: number;
  people_sent: number;
  paybill_till: number;
}
export interface Flag {
  id: string;
  severity: 'High' | 'Medium' | 'Low';
  title: string;
  value: number;
  unit: string;
  detail: string;
}
export interface MonthRow {
  month: string;
  money_in: number;
  money_out: number;
  net: number;
  fuliza: number;
  fuliza_draws: number;
  fuliza_fees: number;
  tx_cost: number;
}
export interface CategoryRow {
  direction: 'In' | 'Out';
  category: string;
  amount: number;
  count: number;
}
export interface HourRow {
  hour: number;
  count: number;
  amount: number;
}
/** Every person seen (no top-N cut; UI ranks). name = upper-cased, space-collapsed. */
export interface PersonRow {
  name: string;
  phone: string;
  sent: number;
  sent_n: number;
  recv: number;
  recv_n: number;
  net: number;
  cost: number;
  first: string;
  last: string;
}
export type PayeeType = 'Paybill' | 'Till / Buy Goods';
/** Every paybill/till payee (no top-N cut). key = `${type}|${name}` */
export interface PayeeRow {
  key: string;
  name: string;
  type: PayeeType;
  amount: number;
  count: number;
  avg: number;
  cost: number;
  top_account: string;
  first: string;
  last: string;
}
export interface BizDowRow {
  day: string;
  day_no: number;
  paybill: number;
  till: number;
  total: number;
  paybill_n: number;
  till_n: number;
  count: number;
  avg: number;
}
export interface BizHourRow {
  hour: number;
  paybill: number;
  till: number;
  total: number;
  count: number;
  avg: number;
}
export interface BizGridRow {
  day: string;
  day_no: number;
  hour: number;
  total: number;
  count: number;
}
export interface BizPartRow {
  part: string;
  total: number;
  count: number;
  paybill: number;
  till: number;
  share: number;
}
export interface BizDayTopRow {
  key: string;
  day: string;
  rank: number;
  name: string;
  amount: number;
}
export type FbCategory = 'Bars & lounges' | 'Restaurants, hotels & food' | 'Butcheries & nyama choma';
export interface FbSummary {
  total: number;
  payments: number;
  venues: number;
  bars: number;
  food: number;
  meat: number;
  per_month: number;
  share_of_till: number;
  bar_nights: number;
  biggest_night: number;
}
export interface FbCatRow {
  category: FbCategory;
  amount: number;
  payments: number;
  venues: number;
  avg: number;
  weekend_pct: number;
  late_pct: number;
}
export interface FbVenueRow {
  rank: number;
  venue: string;
  category: FbCategory;
  amount: number;
  visits: number;
  avg: number;
  late: number;
  first: string;
  last: string;
}
export interface FbSeriesRow {
  bars: number;
  food: number;
  meat: number;
  total: number;
}
export interface FbNightRow {
  night: string;
  day: string;
  amount: number;
  payments: number;
  venues: string;
}
export interface DrainBarRow {
  rank: number;
  venue: string;
  total: number;
  payments: number;
  nights: number;
  per_night: number;
  last_12m: number;
  prev_12m: number;
  late_pct: number;
  biggest_night: number;
  flags: string;
}
export interface DrainPersonRow {
  rank: number;
  name: string;
  phone: string;
  net_out: number;
  sent: number;
  sends: number;
  received: number;
  returned_pct: number;
  sent_12m: number;
  sent_prev_12m: number;
  largest_send: number;
  months_active: number;
  flags: string;
}
export interface LoanMonthRow {
  month: string;
  fuliza: number;
  fuliza_draws: number;
  fuliza_fees: number;
  fuliza_repaid: number;
  kcb_requests: number;
  kcb_repaid: number;
  hustler_in: number;
  hustler_repaid: number;
}
export interface LoanProductRow {
  product: string;
  borrowed: number | null;
  borrow_count: number;
  repaid: number;
  repay_count: number;
  fees: number | null;
  first: string;
  last: string;
  note: string;
}

export interface Analysis {
  summary: Summary;
  flags: Flag[]; // sorted High → Medium → Low
  monthly: MonthRow[]; // every month from first to last txn
  categories: CategoryRow[];
  hours: HourRow[]; // 24 rows, outgoing payments
  people: PersonRow[];
  payees: PayeeRow[];
  biz: { dow: BizDowRow[]; hour: BizHourRow[]; grid: BizGridRow[]; parts: BizPartRow[]; dayTop: BizDayTopRow[] };
  fb: {
    summary: FbSummary;
    cats: FbCatRow[];
    venues: FbVenueRow[];
    yearly: (FbSeriesRow & { year: number; payments: number })[];
    dow: (FbSeriesRow & { day: string; day_no: number; count: number })[];
    hour: (FbSeriesRow & { hour: number; count: number })[];
    monthly: (FbSeriesRow & { month: string })[];
    nights: FbNightRow[];
  };
  drains: { bars: DrainBarRow[]; people: DrainPersonRow[] };
  loans: { monthly: LoanMonthRow[]; products: LoanProductRow[] };
}
