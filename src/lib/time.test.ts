import { describe, expect, it } from 'vitest';
import { isoMinute, monthRange, parts, weekdayOfDate } from './time';

describe('isoMinute', () => {
  it('renders Nairobi time (UTC+3) and crosses the day boundary', () => {
    // 2024-01-01T22:30:45Z is 2024-01-02 01:30 in Nairobi.
    expect(isoMinute(Date.UTC(2024, 0, 1, 22, 30, 45))).toBe('2024-01-02T01:30');
  });

  it('is still the same Nairobi day at 20:59:59Z and rolls over at 21:00:00Z', () => {
    expect(isoMinute(Date.UTC(2026, 10, 15, 20, 59, 59))).toBe('2026-11-15T23:59');
    expect(isoMinute(Date.UTC(2026, 10, 15, 21, 0, 0))).toBe('2026-11-16T00:00');
  });

  it('floors seconds and milliseconds', () => {
    expect(isoMinute(Date.UTC(2026, 10, 15, 9, 0, 59, 999))).toBe('2026-11-15T12:00');
  });

  it('rolls over a year boundary', () => {
    expect(isoMinute(Date.UTC(2026, 11, 31, 21, 5, 0))).toBe('2027-01-01T00:05');
  });
});

describe('parts', () => {
  it('returns Nairobi date, month, year and hour', () => {
    expect(parts(Date.UTC(2026, 11, 31, 22, 0, 0))).toMatchObject({
      date: '2027-01-01',
      month: '2027-01',
      year: 2027,
      hour: 1,
    });
  });

  it('numbers weekdays with Monday = 0', () => {
    // 2026-11-16 is a Monday; 2026-11-22 is a Sunday.
    expect(parts(Date.UTC(2026, 10, 16, 9, 0, 0)).weekday).toBe(0);
    expect(parts(Date.UTC(2026, 10, 22, 9, 0, 0)).weekday).toBe(6);
  });

  it('uses the Nairobi day for the weekday near the UTC boundary', () => {
    // Sunday 21:30Z is already Monday 00:30 in Nairobi.
    expect(parts(Date.UTC(2026, 10, 15, 21, 30, 0)).weekday).toBe(0);
    expect(parts(Date.UTC(2026, 10, 15, 20, 30, 0)).weekday).toBe(6);
  });
});

describe('monthRange', () => {
  it('spans a year boundary inclusively', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });
  it('returns one month when a equals b and empty when a is after b', () => {
    expect(monthRange('2026-05', '2026-05')).toEqual(['2026-05']);
    expect(monthRange('2026-06', '2026-05')).toEqual([]);
  });
});

describe('weekdayOfDate', () => {
  it('is Monday = 0', () => {
    expect(weekdayOfDate('2026-11-16')).toBe(0);
    expect(weekdayOfDate('2026-11-22')).toBe(6);
  });
});
