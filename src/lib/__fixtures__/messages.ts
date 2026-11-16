// Synthetic SMS bodies. Every name, phone, code and amount here is invented.
import type { ParseResult, RawSms, Txn, TxnCat } from '../types';
import { isoMinute } from '../time';

/** 2026-11-16T09:00:00Z, i.e. 12:00 in Nairobi. Arbitrary fixed instant. */
export const T0 = Date.UTC(2026, 10, 16, 9, 0, 0);

export const sms = (body: string, time: number = T0): RawSms => ({ adress: 'MPESA', body, time });
/** A message from a sender that is not M-PESA; the parser must ignore it entirely. */
export const otherSms = (body: string, adress = 'TESTSENDER', time: number = T0): RawSms => ({ adress, body, time });
export const backup = (...bodies: string[]) => ({ listSms: bodies.map((b) => sms(b)) });

export const MSG = {
  send_paybill:
    'QAB1CD2EF3 Confirmed. Ksh1,300.00 sent to Sample Bank Paybill for account 1234 on 14/11/26 at 8:08 PM New M-PESA balance is Ksh200.50. Transaction cost, Ksh15.00.',
  send_person:
    'QAB1CD2EF4 Confirmed. Ksh1,000.00 sent to JANE DOE 0712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh300.00. Transaction cost, Ksh13.00.',
  send_person_intl:
    'QAB1CD2EF4 Confirmed. Ksh1,000.00 sent to JANE DOE +254712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh300.00. Transaction cost, Ksh13.00.',
  send_pochi:
    'QAB1CD2EF5 Confirmed. Ksh150.00 sent to John Sample on 15/11/26 at 4:00 PM. New M-PESA balance is Ksh50.00. Transaction cost, Ksh0.00.',
  till: 'QAB1CD2EF6 Confirmed. Ksh120.00 paid to SAMPLE CAFE. on 16/11/26 at 3:20 PM.New M-PESA balance is Ksh80.00. Transaction cost, Ksh0.00.',
  recv_person:
    'QAB1CD2EF7 Confirmed.You have received Ksh500.00 from JANE DOE 0712***678 on 26/9/26 at 8:04 AM New M-PESA balance is Ksh500.00.',
  recv_person_full:
    'QAB1CD2EF7 Confirmed.You have received Ksh500.00 from JANE DOE 0712345678 on 26/9/26 at 8:04 AM New M-PESA balance is Ksh500.00.',
  recv_person_no_at:
    'QAB1CD2EF7 Confirmed.You have received Ksh500.00 from JANE DOE 0712***678 on 26/9/26 8:04 AM New M-PESA balance is Ksh500.00.',
  recv_person_congrats:
    'Congratulations! QAB1CD2EF7 Confirmed.You have received Ksh500.00 from JANE DOE 0712***678 on 26/9/26 at 8:04 AM New M-PESA balance is Ksh500.00.',
  recv_business:
    'QAB1CD2EF7 Confirmed.You have received Ksh2,500.00 from Sample Bank Bulk Account 123456 on 26/9/26 at 8:04 AM New M-PESA balance is Ksh3,000.00.',
  withdraw:
    'QAB1CD2EF8 Confirmed.on 21/9/26 at 8:24 PMWithdraw Ksh1,500.00 from 012345 - Sample Agent Shop New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh29.00.',
  airtime: 'QAB1CD2EF9 confirmed.You bought Ksh10.00 of airtime on 13/10/26 at 3:20 PM. New M-PESA balance is Ksh90.00.',
  fuliza_draw:
    'QAB1CD2EF6 Confirmed. Fuliza M-PESA amount is Ksh 120.00. Access Fee charged Ksh 1.20. Total Fuliza M-PESA outstanding amount is Ksh 121.20 due on 16/12/26.',
  fuliza_draw_interest:
    'QAB1CD2EF6 Confirmed. Fuliza M-PESA amount is Ksh 120.00. Interest charged Ksh 1.20. Total Fuliza M-PESA outstanding amount is Ksh 121.20 due on 16/12/26.',
  reversal_a:
    'QAB1CD2EG1 confirmed. Reversal of transaction QAB1CD2EG0 has been successfully reversed on 16/11/26 at 1:00 PM and Ksh100.00 is credited to your M-PESA account. New M-PESA balance is Ksh400.00.',
  reversal_b:
    'QAB1CD2EG1 confirmed. Your original transaction QAB1CD2EG0 in favour of SAMPLE SHOP has been reversed on 16/11/26 at 1:00 PM. Ksh400.00 has been credited to your M-PESA account. New M-PESA balance is Ksh900.00.',
  deposit: 'QAB1CD2EG2 Confirmed. On 11/10/26 at 2:36 PM Give Ksh10,000.00 cash to Sample Agent New M-PESA balance is Ksh10,050.00.',
  fuliza_repay_partial: 'QAB1CD2EG3 Confirmed. Ksh 500.00 from your M-PESA has been used to partially pay your outstanding Fuliza M-PESA.',
  fuliza_repay_full: 'QAB1CD2EG3 Confirmed. Ksh 500.00 from your M-PESA has been used to fully pay your outstanding Fuliza M-PESA.',
  fuliza_repay_old: 'QAB1CD2EG3 confirmed. Ksh440.18 paid on 10/11/23 at 12:01 PM. Fuliza Loan repayment successful.',
  kcb_from: 'QAB1CD2EG4 Confirmed. You have transfered Ksh500.00 from your KCB M-PESA account on 1/11/26 at 9:00 AM.',
  kcb_to: 'QAB1CD2EG5 Confirmed. Ksh20,000.00 transfered to KCB M-PESA account on 1/11/26 at 9:00 AM.',
  kcb_repay:
    'QAB1CD2EG6 Confirmed. Your loan repayment of Ksh5,000.00 from your M-PESA account to KCB M-PESA on 1/11/26 at 9:00 AM is successful.',
  mshwari_from: 'QAB1CD2EG7 Confirmed.Ksh1,000.00 transferred from M-Shwari account on 2/11/26 at 9:00 AM.',
  mshwari_to: 'QAB1CD2EG8 Confirmed.Ksh1,500.00 transferred to M-Shwari account on 2/11/26 at 9:00 AM.',
  hustler_repay: 'QAB1CD2EG9 Confirmed. You have sent Ksh1,005.00 to Hustler Fund on 03/11/2026 at 11:22 AM.',
  insufficient: 'Failed. You do not have sufficient funds to complete this transaction.',
  wrong_pin: 'Failed. You entered the wrong PIN.',
  pin_locked: 'Your M-PESA PIN is locked. Please visit a shop to reset it.',
  account_locked: 'Your account has been locked after too many attempts.',
  kcb_loan_a: 'KCBREQ0001 Your KCB M-PESA loan request of Ksh1,000 has been received.',
  kcb_loan_a_again: 'KCBREQ0001 Your KCB M-PESA loan request of Ksh1,000 has been received. Reminder.',
  kcb_loan_b: 'KCBREQ0002 Your KCB M-PESA loan request of Ksh2,000 has been received.',
} as const;

// ---- extra raw-SMS variants (parse.ts coverage gaps) ----
export const MSG_EXTRA = {
  /** "at" with no parsable time after it: `recv` fails, `recv_alt` matches. */
  recv_alt_truncated: 'QAB1CD2EH4 Confirmed. You have received Ksh1,500.00 from JANE ROE 0722***456 on 3/4/24 at',
  cost_lowercase:
    'QAB1CD2EH5 Confirmed. Ksh100.00 sent to JANE DOE 0712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh300.00. transaction cost, Ksh7.00.',
  cost_mixed_case:
    'QAB1CD2EH6 Confirmed. Ksh100.00 sent to JANE DOE 0712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh300.00. Transaction Cost, Ksh29.00.',
  /** Parses as a till payment AND contains every failure keyword. */
  till_with_failure_words:
    'QAB1CD2EH7 Confirmed. Ksh120.00 paid to SAMPLE CAFE. on 16/11/26 at 3:20 PM.New M-PESA balance is Ksh80.00. Earlier: wrong PIN, insufficient funds, PIN is locked.',
  recv_business_no_digits:
    'QAB1CD2EH1 Confirmed.You have received Ksh2,000.00 from Hustler Fund on 26/9/26 at 8:04 AM New M-PESA balance is Ksh2,100.00.',
  send_person_bare_254:
    'QAB1CD2EH2 Confirmed. Ksh700.00 sent to JANE DOE 254712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh300.00. Transaction cost, Ksh7.00.',
  one_decimal_amount:
    'QAB1CD2EH3 Confirmed. Ksh50.5 sent to Sample Bank Paybill for account 77 on 14/11/26 at 8:08 PM New M-PESA balance is Ksh200.50. Transaction cost, Ksh0.00.',
  fuliza_trailing_dot:
    'QAB1CD2EH4 Confirmed. Fuliza M-PESA amount is Ksh 120.. Access Fee charged Ksh 1.20. Total Fuliza M-PESA outstanding amount is Ksh 121.20 due on 16/12/26.',
  negative_balance:
    'QAB1CD2EH5 Confirmed. Ksh100.00 sent to JANE DOE 0712345678 on 16/11/26 at 6:42 AM. New M-PESA balance is Ksh-20.00. Transaction cost, Ksh0.00.',
} as const;

// ---- synthetic ParseResult builder (analysis tests) ----
/** Epoch ms for a Nairobi wall-clock time (UTC+3, no DST). Month is 1-12. */
export const nairobi = (y: number, mo: number, d: number, h = 12, mi = 0) => Date.UTC(y, mo - 1, d, h - 3, mi, 0);

let seq = 0;
/** Build a Txn with a unique invented code; `at` is epoch ms. */
export function txn(cat: TxnCat, at: number, amount: number, extra: Partial<Txn> = {}): Txn {
  const code = `ZZ${String(++seq).padStart(8, '0')}`;
  return { code, cat, ts: at, iso: isoMinute(at), amount, cost: 0, balance: null, ...extra };
}

export const parseResult = (txns: Txn[], counters: Partial<ParseResult['counters']> = {}): ParseResult => ({
  txns,
  counters: { insufficientFunds: 0, wrongPin: 0, pinLocked: 0, kcbLoanRequests: 0, totalSms: txns.length, ...counters },
  kcbLoanRequestTs: [],
});
