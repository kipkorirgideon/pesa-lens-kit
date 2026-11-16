import { describe, expect, it } from 'vitest';
import { isoMinute } from './time';

describe('isoMinute', () => {
  it('renders Nairobi time (UTC+3) and crosses the day boundary', () => {
    // 2024-01-01T22:30:45Z is 2024-01-02 01:30 in Nairobi.
    expect(isoMinute(Date.UTC(2024, 0, 1, 22, 30, 45))).toBe('2024-01-02T01:30');
  });
});
