import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { nairobi, parseResult, txn } from './__fixtures__/messages';
import type { Settings, Txn, TxnCat } from './types';

const NONE: Settings = { excludedPeople: [], extraBars: [], extraFood: [], venueMerges: [] };

describe('analyze: money in / money out membership (SPEC Definitions)', () => {
  const at = nairobi(2026, 5, 10, 12);
  const amounts: [TxnCat, number][] = [
    ['send_person', 1],
    ['send_pochi', 2],
    ['send_paybill', 4],
    ['till', 8],
    ['withdraw', 16],
    ['airtime', 32],
    ['kcb_to', 64],
    ['mshwari_to', 128],
    ['kcb_repay', 256],
    ['hustler_repay', 512],
    ['fuliza_repay', 1024],
    ['recv_person', 1000],
    ['recv_business', 2000],
    ['kcb_from', 3000],
    ['mshwari_from', 4000],
    ['reversal', 5000],
    ['deposit', 6000],
    ['fuliza_draw', 70000],
  ];
  const txns = amounts.map(([cat, amt]) =>
    txn(cat, at, amt, {
      name: cat === 'recv_person' || cat.startsWith('send_p') ? 'Test Person' : 'Test Name',
      fee: cat === 'fuliza_draw' ? 700 : undefined,
    }),
  );
  const a = analyze(parseResult(txns), NONE);

  it('sums only the OUT categories into money_out', () => {
    expect(a.monthly).toHaveLength(1);
    expect(a.monthly[0].money_out).toBe(2047); // 1+2+...+1024
  });

  it('sums only the IN categories into money_in and excludes Fuliza draws', () => {
    expect(a.monthly[0].money_in).toBe(21000);
    expect(a.monthly[0].net).toBe(21000 - 2047);
    expect(a.summary.money_in).toBe(21000);
    expect(a.summary.fuliza).toBe(70000);
  });

  it('lists Fuliza draws in neither direction of categories', () => {
    expect(a.categories.some((c) => c.category.toLowerCase().includes('fuliza') && c.direction === 'In')).toBe(false);
    expect(a.categories.find((c) => c.category === 'Fuliza repayment')).toMatchObject({ direction: 'Out', amount: 1024 });
    expect(a.monthly[0]).toMatchObject({ fuliza: 70000, fuliza_draws: 1, fuliza_fees: 700 });
  });

  it('merges send_person and send_pochi into one "Sent to people" category', () => {
    expect(a.categories.find((c) => c.category === 'Sent to people')).toMatchObject({ direction: 'Out', amount: 3, count: 2 });
  });

  it('labels each inbound category', () => {
    const inn = Object.fromEntries(a.categories.filter((c) => c.direction === 'In').map((c) => [c.category, c.amount]));
    expect(inn).toEqual({
      'From people': 1000,
      'From banks & businesses': 2000,
      'From KCB M-PESA': 3000,
      'From M-Shwari': 4000,
      Reversals: 5000,
      'Cash deposits at agent': 6000,
    });
  });
});

describe('analyze: monthly coverage', () => {
  it('has a row for every month from first to last transaction, including empty ones', () => {
    const a = analyze(
      parseResult([
        txn('recv_person', nairobi(2025, 11, 20), 1000, { name: 'Test Person' }),
        txn('till', nairobi(2026, 2, 3), 300, { name: 'Test Shop' }),
      ]),
      NONE,
    );
    expect(a.monthly.map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(a.monthly[1]).toMatchObject({ money_in: 0, money_out: 0, net: 0 });
    expect(a.monthly[3]).toMatchObject({ money_out: 300 });
    expect(a.summary).toMatchObject({ first: '2025-11-20', last: '2026-02-03' });
    expect(a.fb.monthly.map((m) => m.month)).toEqual(a.monthly.map((m) => m.month));
  });

  it('puts a month-end late-evening transaction in the right Nairobi month', () => {
    // 22:30 Nairobi on 31 Jan is already 19:30 UTC the same day; 01:00 Nairobi on 1 Feb is 22:00 UTC on 31 Jan.
    const a = analyze(
      parseResult([
        txn('till', nairobi(2026, 2, 1, 1, 0), 50, { name: 'Test Shop' }),
        txn('till', nairobi(2026, 1, 31, 22, 30), 20, { name: 'Test Shop' }),
      ]),
      NONE,
    );
    expect(a.monthly.map((m) => [m.month, m.money_out])).toEqual([
      ['2026-01', 20],
      ['2026-02', 50],
    ]);
  });

  it('throws a friendly error on an empty backup', () => {
    expect(() => analyze(parseResult([]), NONE)).toThrow(/No M-PESA transactions/);
  });
});

describe('analyze: people merge', () => {
  const txns = [
    txn('send_person', nairobi(2026, 1, 10), 6000, { name: 'Test  Person', phone: '0700000001', cost: 13 }),
    txn('send_pochi', nairobi(2026, 1, 12), 1000, { name: 'test person', cost: 5 }),
    txn('recv_person', nairobi(2026, 1, 20), 2500, { name: 'TEST PERSON', phone: '0700***001' }),
    txn('send_person', nairobi(2026, 1, 21), 400, { name: 'Other One', phone: '0700000002' }),
  ];
  const a = analyze(parseResult(txns), NONE);
  const p = a.people.find((x) => x.name === 'TEST PERSON')!;

  it('merges name variants across send_person, send_pochi and recv_person', () => {
    expect(a.people.map((x) => x.name).sort()).toEqual(['OTHER ONE', 'TEST PERSON']);
    expect(p).toMatchObject({
      sent: 7000,
      sent_n: 2,
      recv: 2500,
      recv_n: 1,
      net: -4500,
      cost: 18,
      first: '2026-01-10',
      last: '2026-01-20',
    });
  });

  it('prefers a full phone over a masked one', () => {
    expect(p.phone).toBe('0700000001');
  });

  it('sorts by amount sent, descending', () => {
    expect(a.people.map((x) => x.name)).toEqual(['TEST PERSON', 'OTHER ONE']);
  });
});

describe('analyze: night-of-week rule', () => {
  // 2026-04-25 is a Saturday, 2026-04-26 a Sunday.
  const bar = (at: number, amt: number): Txn => txn('till', at, amt, { name: 'Sample Lounge' });

  it('counts a 02:00 payment to the previous evening', () => {
    const a = analyze(parseResult([bar(nairobi(2026, 4, 26, 2, 0), 900)]), NONE);
    expect(a.fb.nights[0]).toMatchObject({ night: '2026-04-25', day: 'Sat', amount: 900, payments: 1 });
    expect(a.fb.dow[5]).toMatchObject({ day: 'Sat', bars: 900, count: 1 }); // Sat
    expect(a.fb.dow[6]).toMatchObject({ day: 'Sun', bars: 0, count: 0 });
    expect(a.fb.hour[2]).toMatchObject({ hour: 2, bars: 900 }); // hour table uses the real clock hour
  });

  it('merges the 23:00 and 02:00 payments of one night into a single night', () => {
    const a = analyze(parseResult([bar(nairobi(2026, 4, 25, 23, 0), 600), bar(nairobi(2026, 4, 26, 2, 0), 900)]), NONE);
    expect(a.fb.nights).toHaveLength(1);
    expect(a.fb.nights[0]).toMatchObject({ night: '2026-04-25', amount: 1500, payments: 2 });
    expect(a.fb.summary).toMatchObject({ bar_nights: 1, biggest_night: 1500 });
  });

  it('keeps a 05:00 payment on its own calendar day (cut-off is 05:00)', () => {
    const a = analyze(parseResult([bar(nairobi(2026, 4, 26, 5, 0), 100)]), NONE);
    expect(a.fb.nights[0]).toMatchObject({ night: '2026-04-26', day: 'Sun' });
  });

  it('pins the cut-off exactly: 04:59 is the previous evening, 05:00 is the same day', () => {
    // 04:59 kills any offset below 5 h (e.g. 4 h gives 00:59 on the same day).
    // 05:00 kills any offset above 5 h (e.g. 6 h gives 23:00 on the previous day).
    const before = analyze(parseResult([bar(nairobi(2026, 4, 26, 4, 59), 100)]), NONE);
    expect(before.fb.nights[0]).toMatchObject({ night: '2026-04-25', day: 'Sat' });
    const at = analyze(parseResult([bar(nairobi(2026, 4, 26, 5, 0), 100)]), NONE);
    expect(at.fb.nights[0]).toMatchObject({ night: '2026-04-26', day: 'Sun' });
  });

  it('uses the 5-hour-earlier date only for nights, not for the "night" flag hours', () => {
    const a = analyze(parseResult([bar(nairobi(2026, 4, 26, 2, 0), 900)]), NONE);
    expect(a.flags.find((f) => f.id === 'night')).toMatchObject({ value: 1 });
  });
});

describe('analyze: settings (excluded people)', () => {
  const end = nairobi(2026, 6, 30, 12);
  const mk = () => {
    const txns: Txn[] = [];
    // Beth: one big send, nothing back, funded by Fuliza (same code).
    const beth = txn('send_person', nairobi(2026, 3, 1), 15000, { name: 'Beth Sample', phone: '0700000003' });
    txns.push(beth, { ...txn('fuliza_draw', nairobi(2026, 3, 1), 500, { fee: 5 }), code: beth.code });
    // Chris: 45 small sends in the last 90 days, nothing back.
    for (let i = 0; i < 45; i++) txns.push(txn('send_person', end - (i + 1) * 86400e3, 300, { name: 'Chris Often', phone: '0700000004' }));
    // Dan: not excluded, sent 12000, got back 2000 (drain, but not one-way).
    txns.push(txn('send_person', nairobi(2026, 2, 1), 12000, { name: 'Dan Sample', phone: '0700000005' }));
    txns.push(txn('recv_person', nairobi(2026, 2, 5), 2000, { name: 'Dan Sample', phone: '0700000005' }));
    txns.push(txn('till', end, 10, { name: 'Test Shop' }));
    return parseResult(txns);
  };
  const flag = (a: ReturnType<typeof analyze>, id: string) => a.flags.find((f) => f.id === id)!;

  it('baseline: nobody excluded, everyone is flagged', () => {
    const a = analyze(mk(), NONE);
    expect(a.drains.people.map((p) => p.name).sort()).toEqual(['Beth Sample', 'Chris Often', 'Dan Sample']);
    expect(flag(a, 'oneway').value).toBe(2);
    expect(flag(a, 'borrow_give').value).toBe(500);
    expect(flag(a, 'frequent').value).toBe(1);
  });

  it('excluded people leave drains and the oneway / borrow_give / frequent flags, but stay in people', () => {
    const a = analyze(mk(), { ...NONE, excludedPeople: [' beth  SAMPLE', 'Chris Often'] });
    expect(a.drains.people.map((p) => p.name)).toEqual(['Dan Sample']);
    expect(flag(a, 'oneway').value).toBe(0);
    expect(flag(a, 'borrow_give').value).toBe(0);
    expect(flag(a, 'frequent').value).toBe(0);
    expect(flag(a, 'oneway').detail).toContain('excluded in Settings');
    const names = a.people.map((p) => p.name);
    expect(names).toContain('BETH SAMPLE');
    expect(names).toContain('CHRIS OFTEN');
    expect(a.people.find((p) => p.name === 'BETH SAMPLE')?.sent).toBe(15000);
  });

  it('excluding one person leaves the others flagged', () => {
    const a = analyze(mk(), { ...NONE, excludedPeople: ['Beth Sample'] });
    expect(flag(a, 'oneway').value).toBe(1);
    expect(flag(a, 'borrow_give').value).toBe(0);
    expect(flag(a, 'frequent').value).toBe(1);
  });

  it('extraBars reclassifies a payee as a bar (with or without the type prefix)', () => {
    const r = parseResult([txn('till', nairobi(2026, 4, 25, 20), 700, { name: 'Sample Hardware.' })]);
    expect(analyze(r, NONE).fb.summary.payments).toBe(0);
    for (const extra of ['Sample Hardware', 'Till / Buy Goods|Sample Hardware']) {
      const a = analyze(r, { ...NONE, extraBars: [extra] });
      expect(a.fb.summary).toMatchObject({ payments: 1, bars: 700 });
    }
  });
  it('extraBars prefix works through the type| key form, and a mid-name entry does not match', () => {
    const r2 = parseResult([
      txn('till', nairobi(2026, 4, 25, 20), 700, { name: 'Sample Hardware Annex' }),
      txn('till', nairobi(2026, 4, 26, 20), 300, { name: 'Other Sample Hardware' }),
    ]);
    const a = analyze(r2, { ...NONE, extraBars: ['Paybill|sample  hard'] });
    expect(a.fb.summary).toMatchObject({ payments: 1, bars: 700 });
  });
});

describe('analyze: settings (extraFood, venueMerges)', () => {
  const r = parseResult([
    txn('till', nairobi(2026, 4, 25, 13), 400, { name: 'Sample Plot 1' }),
    txn('till', nairobi(2026, 4, 26, 13), 600, { name: 'Sample Plot 2' }),
  ]);
  it('extraFood makes unrecognised payees food, and add/remove is reflected', () => {
    expect(analyze(r, NONE).fb.summary.payments).toBe(0);
    const a = analyze(r, { ...NONE, extraFood: ['sample plot'] });
    expect(a.fb.summary).toMatchObject({ payments: 2, food: 1000 });
    expect(a.fb.venues.map((v) => v.venue).sort()).toEqual(['Sample Plot 1', 'Sample Plot 2']);
  });
  it('venueMerges folds several tills into one venue row', () => {
    const a = analyze(r, { ...NONE, extraFood: ['sample plot'], venueMerges: [{ match: 'SAMPLE PLOT', name: 'Sample Plot (all)' }] });
    expect(a.fb.venues).toHaveLength(1);
    expect(a.fb.venues[0]).toMatchObject({ venue: 'Sample Plot (all)', amount: 1000, visits: 2 });
  });
});
