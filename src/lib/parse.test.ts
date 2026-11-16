import { describe, expect, it } from 'vitest';
import { collapse, parseBackup } from './parse';
import { backup, MSG, sms, T0 } from './__fixtures__/messages';

const one = (body: string) => {
  const r = parseBackup(backup(body));
  expect(r.txns).toHaveLength(1);
  return r.txns[0];
};

describe('parse rules (SPEC 1-17)', () => {
  it('1 send_paybill', () => {
    expect(one(MSG.send_paybill)).toMatchObject({
      code: 'QAB1CD2EF3',
      cat: 'send_paybill',
      amount: 1300,
      name: 'Sample Bank Paybill',
      account: '1234',
      cost: 15,
      balance: 200.5,
    });
  });

  it('2 send_person (local and +254 phone)', () => {
    expect(one(MSG.send_person)).toMatchObject({
      cat: 'send_person',
      amount: 1000,
      name: 'JANE DOE',
      phone: '0712345678',
      cost: 13,
      balance: 300,
    });
    expect(one(MSG.send_person_intl)).toMatchObject({ cat: 'send_person', phone: '+254712345678' });
  });

  it('3 send_pochi', () => {
    const t = one(MSG.send_pochi);
    expect(t).toMatchObject({ cat: 'send_pochi', amount: 150, name: 'John Sample', cost: 0, balance: 50 });
    expect(t.phone).toBeUndefined();
  });

  it('4 till strips trailing dot', () => {
    expect(one(MSG.till)).toMatchObject({ cat: 'till', amount: 120, name: 'SAMPLE CAFE', cost: 0, balance: 80 });
  });

  it('5a recv_person (masked phone, full phone, missing "at", Congratulations prefix)', () => {
    expect(one(MSG.recv_person)).toMatchObject({
      code: 'QAB1CD2EF7',
      cat: 'recv_person',
      amount: 500,
      name: 'JANE DOE',
      phone: '0712***678',
      balance: 500,
    });
    expect(one(MSG.recv_person_full)).toMatchObject({ cat: 'recv_person', phone: '0712345678' });
    expect(one(MSG.recv_person_no_at)).toMatchObject({ cat: 'recv_person', name: 'JANE DOE', amount: 500 });
    expect(one(MSG.recv_person_congrats)).toMatchObject({ code: 'QAB1CD2EF7', cat: 'recv_person', amount: 500 });
  });

  it('5b recv_business (no phone tail)', () => {
    const t = one(MSG.recv_business);
    expect(t).toMatchObject({
      cat: 'recv_business',
      amount: 2500,
      name: 'Sample Bank Bulk Account 123456',
      balance: 3000,
    });
    expect(t.phone).toBeUndefined();
  });

  it('6 withdraw', () => {
    expect(one(MSG.withdraw)).toMatchObject({
      cat: 'withdraw',
      amount: 1500,
      name: '012345 - Sample Agent Shop',
      cost: 29,
      balance: 1000,
    });
  });

  it('7 airtime', () => {
    expect(one(MSG.airtime)).toMatchObject({ cat: 'airtime', amount: 10, balance: 90 });
  });

  it('8 fuliza_draw (Access Fee and older Interest wording)', () => {
    expect(one(MSG.fuliza_draw)).toMatchObject({ code: 'QAB1CD2EF6', cat: 'fuliza_draw', amount: 120, fee: 1.2 });
    expect(one(MSG.fuliza_draw_interest)).toMatchObject({ cat: 'fuliza_draw', amount: 120, fee: 1.2 });
  });

  it('9 reversal (both wordings)', () => {
    expect(one(MSG.reversal_a)).toMatchObject({
      code: 'QAB1CD2EG1',
      cat: 'reversal',
      amount: 100,
      orig: 'QAB1CD2EG0',
      balance: 400,
    });
    expect(one(MSG.reversal_b)).toMatchObject({ cat: 'reversal', amount: 400, orig: 'QAB1CD2EG0' });
  });

  it('10 deposit', () => {
    expect(one(MSG.deposit)).toMatchObject({ cat: 'deposit', amount: 10000, name: 'Sample Agent', balance: 10050 });
  });

  it('11 fuliza_repay (partially, fully, older wording)', () => {
    expect(one(MSG.fuliza_repay_partial)).toMatchObject({ cat: 'fuliza_repay', amount: 500 });
    expect(one(MSG.fuliza_repay_full)).toMatchObject({ cat: 'fuliza_repay', amount: 500 });
    expect(one(MSG.fuliza_repay_old)).toMatchObject({ code: 'QAB1CD2EG3', cat: 'fuliza_repay', amount: 440.18 });
  });

  it('12 kcb_from', () => {
    expect(one(MSG.kcb_from)).toMatchObject({ cat: 'kcb_from', amount: 500 });
  });
  it('13 kcb_to', () => {
    expect(one(MSG.kcb_to)).toMatchObject({ cat: 'kcb_to', amount: 20000 });
  });
  it('14 kcb_repay', () => {
    expect(one(MSG.kcb_repay)).toMatchObject({ cat: 'kcb_repay', amount: 5000 });
  });
  it('15 mshwari_from', () => {
    expect(one(MSG.mshwari_from)).toMatchObject({ cat: 'mshwari_from', amount: 1000 });
  });
  it('16 mshwari_to', () => {
    expect(one(MSG.mshwari_to)).toMatchObject({ cat: 'mshwari_to', amount: 1500 });
  });
  it('17 hustler_repay', () => {
    expect(one(MSG.hustler_repay)).toMatchObject({ cat: 'hustler_repay', amount: 1005 });
  });
});

describe('general extraction', () => {
  it('collapses whitespace and upper-cases the code', () => {
    expect(collapse('  a \n\t b  ')).toBe('a b');
    const t = one('qab1cd2ef4  Confirmed.\n Ksh1,000.00 sent to JANE   DOE 0712345678 on 16/11/26 at 6:42 AM.');
    expect(t.code).toBe('QAB1CD2EF4');
    expect(t.name).toBe('JANE DOE');
  });

  it('defaults cost to 0 and balance to null when absent', () => {
    const t = one(MSG.fuliza_repay_partial);
    expect(t.cost).toBe(0);
    expect(t.balance).toBeNull();
  });

  it('ignores unrelated messages', () => {
    expect(parseBackup(backup('Hello, this is not a transaction.')).txns).toHaveLength(0);
  });

  it('sets ts from the SMS time and iso in Nairobi time', () => {
    const t = parseBackup({ listSms: [sms(MSG.airtime, T0)] }).txns[0];
    expect(t.ts).toBe(T0);
    expect(t.iso).toBe('2026-11-16T12:00');
  });
});

describe('order sensitivity', () => {
  it('a paybill message is not captured by send_person or send_pochi', () => {
    expect(one(MSG.send_paybill).cat).toBe('send_paybill');
    // Even with a phone-like account the paybill rule comes first.
    expect(one('QAB1CD2EH1 Confirmed. Ksh100.00 sent to Sample Utility for account 0712345678 on 14/11/26 at 8:08 PM').cat).toBe(
      'send_paybill',
    );
  });

  it('a person send with a phone is not captured by send_pochi', () => {
    const t = one(MSG.send_person);
    expect(t.cat).toBe('send_person');
    expect(t.phone).toBe('0712345678');
    expect(t.name).toBe('JANE DOE');
  });
});

describe('dedupe', () => {
  it('the same message twice yields one Txn', () => {
    const r = parseBackup(backup(MSG.till, MSG.till));
    expect(r.txns).toHaveLength(1);
    expect(r.counters.totalSms).toBe(2);
  });

  it('a payment and its Fuliza draw share a code but yield two Txns', () => {
    const r = parseBackup(backup(MSG.till, MSG.fuliza_draw));
    expect(r.txns.map((t) => t.cat)).toEqual(['till', 'fuliza_draw']);
    expect(r.txns[0].code).toBe(r.txns[1].code);
  });

  it('dedupes a recv_person repeated with different casing of the code', () => {
    const r = parseBackup(backup(MSG.recv_person, MSG.recv_person.replace('QAB1CD2EF7', 'qab1cd2ef7')));
    expect(r.txns).toHaveLength(1);
  });
});

describe('counters', () => {
  it('counts insufficient funds, wrong PIN and PIN locked (both wordings)', () => {
    const r = parseBackup(backup(MSG.insufficient, MSG.wrong_pin, MSG.pin_locked, MSG.account_locked));
    expect(r.counters).toMatchObject({ insufficientFunds: 1, wrongPin: 1, pinLocked: 2, kcbLoanRequests: 0, totalSms: 4 });
    expect(r.txns).toHaveLength(0);
  });

  it('counts "insufficient" wording too', () => {
    expect(parseBackup(backup('Failed: insufficient balance')).counters.insufficientFunds).toBe(1);
  });

  it('dedupes KCB loan requests by the first 10 characters', () => {
    const r = parseBackup({
      listSms: [sms(MSG.kcb_loan_a, T0), sms(MSG.kcb_loan_a_again, T0 + 1000), sms(MSG.kcb_loan_b, T0 + 2000)],
    });
    expect(r.counters.kcbLoanRequests).toBe(2);
    expect(r.kcbLoanRequestTs).toEqual([T0, T0 + 2000]);
  });
});
