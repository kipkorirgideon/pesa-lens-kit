import { describe, expect, it } from 'vitest';
import { classifyPayee, payeeName, personKey, venueName } from './classify';

const BARS = 'Bars & lounges';
const FOOD = 'Restaurants, hotels & food';
const MEAT = 'Butcheries & nyama choma';

describe('classifyPayee', () => {
  it.each([
    'SAMPLE BAR',
    'Sample Bar & Grill Annex BAR',
    'SAMPLE PUB',
    'SAMPLE WINES',
    'SAMPLE LIQUOR STORE',
    'SAMPLE CLUB',
    'SAMPLE GARDENS',
    'SAMPLE ROOFTOP',
    'SAMPLE RESORT',
    'SAMPLE LOUNGE',
  ])('bar keyword: %s', (n) => expect(classifyPayee(n)).toBe(BARS));

  it('MILK BAR is food, not a bar, in either word order, while real bars stay bars', () => {
    expect(classifyPayee('SAMPLE MILK BAR')).toBe(FOOD);
    expect(classifyPayee('Demo Milk Bar')).toBe(FOOD);
    expect(classifyPayee('MILK BAR DEMO')).toBe(FOOD);
    expect(classifyPayee('SAMPLE BAR')).toBe(BARS);
    expect(classifyPayee('DEMO MILKY WAY BAR')).toBe(BARS);
    expect(classifyPayee('SAMPLE MILK BAR WINES')).toBe(BARS); // another bar keyword still wins
  });

  it('LOUNGE is a bar but a KINYOZI lounge (barber) is nothing', () => {
    expect(classifyPayee('SAMPLE LOUNGE')).toBe(BARS);
    expect(classifyPayee('SAMPLE LOUNGE KINYOZI')).toBeNull();
    expect(classifyPayee('SAMPLE KINYOZI')).toBeNull();
  });

  it.each(['SAMPLE RESTAURANT', 'SAMPLE HOTEL', 'SAMPLE CAFE', 'SAMPLE PIZZA', 'SAMPLE EATERY'])('food keyword: %s', (n) =>
    expect(classifyPayee(n)).toBe(FOOD),
  );

  it('butchery is matched before food', () => {
    expect(classifyPayee('SAMPLE BUTCHERY')).toBe(MEAT);
    expect(classifyPayee('SAMPLE BUTCHERY AND GRILL')).toBe(MEAT);
    expect(classifyPayee('SAMPLE MEAT POINT')).toBe(MEAT);
  });

  it('bar wins over meat', () => {
    expect(classifyPayee('SAMPLE BUTCHER BAR')).toBe(BARS);
  });

  it.each(['SAMPLE SUPERMARKET', 'SAMPLE SACCO', 'SAMPLE BANK', 'SAMPLE KITCHENWARE', 'SAMPLE TYRES'])(
    'NOT_FB exclusion beats keywords: %s',
    (n) => {
      expect(classifyPayee(n)).toBeNull();
      expect(classifyPayee(`${n} BAR`)).toBeNull();
      expect(classifyPayee(`${n} RESTAURANT`)).toBeNull();
    },
  );

  it('unrelated payees are null', () => {
    expect(classifyPayee('SAMPLE HARDWARE')).toBeNull();
  });

  it('extraBars wins even over an exclusion, and matches case-insensitively', () => {
    const extra = new Set(['SAMPLE SACCO']);
    expect(classifyPayee('SAMPLE SACCO')).toBeNull();
    expect(classifyPayee('SAMPLE SACCO', { extraBars: extra })).toBe(BARS);
    expect(classifyPayee('Sample Sacco', { extraBars: extra })).toBe(BARS);
    expect(classifyPayee('SAMPLE HARDWARE', { extraBars: new Set(['SAMPLE HARDWARE']) })).toBe(BARS);
  });
});

describe('name normalisation', () => {
  it('payeeName collapses whitespace, trims and strips trailing dots but keeps case', () => {
    expect(payeeName('  Sample   Cafe..  ')).toBe('Sample Cafe');
    expect(payeeName('Sample\tCafe\n')).toBe('Sample Cafe');
    expect(payeeName('Sample Cafe.')).toBe('Sample Cafe');
  });

  it('payeeName leaves inner dots alone', () => {
    expect(payeeName('S.A. Sample Ltd.')).toBe('S.A. Sample Ltd');
  });

  it('personKey upper-cases and collapses whitespace but keeps dots', () => {
    expect(personKey('  jane   doe ')).toBe('JANE DOE');
    expect(personKey('Jane\tDoe')).toBe('JANE DOE');
    expect(personKey('jane doe.')).toBe('JANE DOE.');
  });
});

describe('settings-driven classification', () => {
  const extraFood = ['Sample Plot', 'ACME EXACT'];
  it('extraFood matches by prefix or exact name, case-insensitively', () => {
    expect(classifyPayee('SAMPLE PLOT 4', { extraFood })).toBe(FOOD);
    expect(classifyPayee('sample plot', { extraFood })).toBe(FOOD);
    expect(classifyPayee('ACME EXACT', { extraFood })).toBe(FOOD);
    expect(classifyPayee('SAMPLE PLOT 4')).toBeNull();
  });
  it('extraFood is not a substring or regex match', () => {
    expect(classifyPayee('THE SAMPLE PLOT', { extraFood })).toBeNull();
    expect(classifyPayee('ANYTHING', { extraFood: ['.*', ''] })).toBeNull();
    expect(classifyPayee('AAAAAAAAAAAAAAAAAAAAAAAA!', { extraFood: ['(a+)+$'] })).toBeNull();
  });
  it('extraFood keeps the built-in order: NOT_FB, bar and meat win over it', () => {
    expect(classifyPayee('SAMPLE PLOT SACCO', { extraFood })).toBeNull();
    expect(classifyPayee('SAMPLE PLOT BAR', { extraFood })).toBe(BARS);
    expect(classifyPayee('SAMPLE PLOT BUTCHERY', { extraFood })).toBe(MEAT);
  });
  it('venueName merges by prefix, first rule wins, ignores empty rules', () => {
    const merges = [
      { match: '', name: 'EVERYTHING' },
      { match: 'sample hq', name: 'Sample HQ' },
      { match: 'sample', name: 'Sample Other' },
    ];
    expect(venueName('SAMPLE HQ TILL 2', merges)).toBe('Sample HQ');
    expect(venueName('SAMPLE ANNEX', merges)).toBe('Sample Other');
    expect(venueName('OTHER PLACE', merges)).toBe('OTHER PLACE');
    expect(venueName('SAMPLE HQ')).toBe('SAMPLE HQ');
    expect(venueName('MY SAMPLE HQ', merges)).toBe('MY SAMPLE HQ');
  });
});
