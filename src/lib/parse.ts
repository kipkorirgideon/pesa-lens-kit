// M-PESA SMS parser — TypeScript port of reference/python/parse.py + analyze.py.
// Rules are tried in order on the whitespace-collapsed body; the first match wins.
import type { ParseResult, RawSms, Txn, TxnCat } from './types';
import { isoMinute } from './time';

const A = String.raw`Ksh\s?([\d,]+\.\d{1,2})`; // amount "Ksh1,234.00"
const DT = String.raw`on (\d{1,2}/\d{1,2}/\d{2,4}) at (\d{1,2}:\d{2}(?: ?[AP]M)?)`; // "on 1/2/24 at 9:05 PM"
const CONF = String.raw`^(\w{10}) Confirmed\.`; // transaction code prefix
const rx = (s: string) => new RegExp(s, 'i');

/** Rule names follow the Python (dedupe key uses them); `recv`/`recv_alt` split later, `fuliza_repay2` maps to fuliza_repay. */
type Rule =
  | 'send_paybill'
  | 'send_person'
  | 'send_pochi'
  | 'till'
  | 'recv'
  | 'withdraw'
  | 'airtime'
  | 'fuliza_draw'
  | 'reversal'
  | 'deposit'
  | 'fuliza_repay2'
  | 'fuliza_repay'
  | 'kcb_from'
  | 'kcb_to'
  | 'kcb_repay'
  | 'mshwari_from'
  | 'mshwari_to'
  | 'hustler_repay'
  | 'recv_alt';

export const RULES: [Rule, RegExp][] = [
  // "sent to KPLC PREPAID for account 1234 on ..."
  ['send_paybill', rx(`${CONF} ?${A} sent to (.+?) for account (.*?) ?${DT}`)],
  // "sent to JOHN DOE 0712345678 on ..."
  ['send_person', rx(`${CONF} ?${A} sent to (.+?) (0\\d{9}|\\+?254\\d{9}) ${DT}`)],
  // Pochi la Biashara: "sent to JOHN DOE on ..." (no phone, no account)
  ['send_pochi', rx(`${CONF} ?${A} sent to (.+?) ${DT}`)],
  // Buy Goods till: "paid to SHOP NAME. on ..."
  ['till', rx(`${CONF} ?${A} paid to (.+?)\\.? ${DT}`)],
  // "You have received Ksh.. from X on d/m/y at h:mm" (optionally prefixed "Congratulations! ")
  [
    'recv',
    rx(
      String.raw`^(?:Congratulations! )?(\w{10}) Confirmed\.? ?You have received ${A} from (.+?) on (\d{1,2}/\d{1,2}/\d{2,4}) (?:at )?(\d{1,2}:\d{2}(?: ?[AP]M)?)`,
    ),
  ],
  ['withdraw', rx(String.raw`^(\w{10}) Confirmed\.? ?${DT} ?Withdraw ${A} from (.+?) New M-PESA`)],
  ['airtime', rx(String.raw`^(\w{10}) confirmed\.? ?You bought ${A} of airtime`)],
  ['fuliza_draw', rx(String.raw`${CONF} Fuliza M-PESA amount is Ksh ?([\d,.]+)\. (?:Access Fee|Interest) charged Ksh ?([\d,.]+)`)],
  [
    'reversal',
    rx(String.raw`^(\w{10}) confirmed\. (?:Reversal of transaction|Your original transaction) (\w{10}).*?${A} (?:is|has been) credited`),
  ],
  ['deposit', rx(String.raw`${CONF} On .*? Give ${A} cash to (.+?) New M-PESA`)],
  ['fuliza_repay2', rx(String.raw`^(\w{10}) confirmed\. ${A} paid on .*?Fuliza Loan repayment`)],
  ['fuliza_repay', rx(String.raw`^(\w{10})\s+Confirmed\. Ksh ?([\d,.]+) from your M-PESA has been used to (?:fully|partially) pay`)],
  ['kcb_from', rx(`${CONF} You have transfered ${A} from your KCB M-PESA`)],
  ['kcb_to', rx(`${CONF} ${A} transfered to KCB M-PESA`)],
  ['kcb_repay', rx(`${CONF} Your loan repayment of ${A}`)],
  ['mshwari_from', rx(String.raw`^(\w{10}) Confirmed\.? ?${A} transferred from M-Shwari`)],
  ['mshwari_to', rx(String.raw`^(\w{10}) Confirmed\.? ?${A} transferred to M-Shwari`)],
  ['hustler_repay', rx(`${CONF} You have sent ${A} to Hustler Fund`)],
  ['recv_alt', rx(String.raw`${CONF} You have received ${A} from (.+?) on (\d{1,2}/\d{1,2}/\d{2,4}) at`)],
];

/** Python f(): strip commas and a trailing dot, then float. */
const num = (s: string) => parseFloat(s.replace(/,/g, '').replace(/\.+$/, ''));
const COST = /Transaction cost,? Ksh\.?\s?([\d,]+\.\d+)/; // case-sensitive, as in Python
const BAL = /New M-?PESA (?:account )?balance is Ksh\s?(-?[\d,]+\.\d+)/i;
/** Sender ending in a full or masked phone => a person ("JOHN DOE 0727***224"). */
const PHONE_TAIL = /^(.*?)\s+((?:0|\+?254)\d[\d*]{6,10})$/;

export const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

export function parseBackup(raw: { listSms: RawSms[] }): ParseResult {
  const list = raw.listSms;
  const seen = new Set<string>();
  const txns: Txn[] = [];
  let insufficientFunds = 0,
    wrongPin = 0,
    pinLocked = 0;
  const kcbSeen = new Set<string>();
  const kcbLoanRequestTs: number[] = [];

  for (const m of list) {
    const rawBody = String(m.body ?? '');
    // Counters on the raw body (non-transaction messages)
    if (/insufficient|not have sufficient/i.test(rawBody)) insufficientFunds++;
    if (/wrong PIN/i.test(rawBody)) wrongPin++;
    if (/PIN is locked|account has been locked/i.test(rawBody)) pinLocked++;
    if (rawBody.includes('KCB M-PESA loan request')) {
      const k = rawBody.slice(0, 10); // dedupe by leading code
      if (!kcbSeen.has(k)) {
        kcbSeen.add(k);
        kcbLoanRequestTs.push(m.time);
      }
    }

    const b = collapse(rawBody);
    for (const [rule, re] of RULES) {
      const g = re.exec(b);
      if (!g) continue;
      const code = g[1].toUpperCase();
      const key = rule + '|' + code;
      if (seen.has(key)) break; // duplicate SMS: stop (first match wins, even if a duplicate)
      seen.add(key);
      const cm = COST.exec(b),
        bm = BAL.exec(b);
      const t: Txn = {
        code,
        cat: rule as TxnCat,
        ts: m.time,
        iso: isoMinute(m.time),
        amount: 0,
        cost: cm ? num(cm[1]) : 0,
        balance: bm ? num(bm[1]) : null,
      };
      switch (rule) {
        case 'send_person':
          Object.assign(t, { amount: num(g[2]), name: g[3], phone: g[4] });
          break;
        case 'send_pochi':
          Object.assign(t, { amount: num(g[2]), name: g[3] });
          break;
        case 'send_paybill':
          Object.assign(t, { amount: num(g[2]), name: g[3], account: g[4] });
          break;
        case 'till':
          Object.assign(t, { amount: num(g[2]), name: g[3].replace(/[. ]+$/, '') });
          break;
        case 'recv':
        case 'recv_alt': {
          t.amount = num(g[2]);
          const nm = g[3].trim(),
            p = PHONE_TAIL.exec(nm);
          if (p) Object.assign(t, { cat: 'recv_person', name: p[1], phone: p[2] });
          else Object.assign(t, { cat: 'recv_business', name: nm });
          break;
        }
        case 'withdraw':
          Object.assign(t, { amount: num(g[4]), name: g[5] });
          break;
        case 'fuliza_draw':
          Object.assign(t, { amount: num(g[2]), fee: num(g[3]) });
          break;
        case 'reversal':
          Object.assign(t, { amount: num(g[3]), orig: g[2] });
          break;
        case 'deposit':
          Object.assign(t, { amount: num(g[2]), name: g[3] });
          break;
        case 'fuliza_repay2':
          Object.assign(t, { cat: 'fuliza_repay', amount: num(g[2]) });
          break;
        default:
          t.amount = num(g[2]);
      }
      txns.push(t);
      break;
    }
  }
  return {
    txns,
    counters: { insufficientFunds, wrongPin, pinLocked, kcbLoanRequests: kcbSeen.size, totalSms: list.length },
    kcbLoanRequestTs,
  };
}
