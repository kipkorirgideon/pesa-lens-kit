import { describe, expect, it } from 'vitest';
import { loadSettingsFrom, sanitizeSettings, SETTINGS_KEY, SETTINGS_KEY_V1 } from './settings';
import { DEFAULT_SETTINGS } from './types';

const fakeStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('settings migration v1 -> v2', () => {
  it('keeps v1 excludedPeople and extraBars, adds empty new fields, writes v2, leaves v1', () => {
    const v1 = JSON.stringify({ excludedPeople: ['JANE SAMPLE', 'JOHN TEST'], extraBars: ['SAMPLE SPOT'] });
    const store = fakeStore({ [SETTINGS_KEY_V1]: v1 });
    const s = loadSettingsFrom(store);
    expect(s).toEqual({
      excludedPeople: ['JANE SAMPLE', 'JOHN TEST'],
      extraBars: ['SAMPLE SPOT'],
      extraFood: [],
      venueMerges: [],
    });
    expect(JSON.parse(store.m.get(SETTINGS_KEY)!)).toEqual(s);
    expect(store.m.get(SETTINGS_KEY_V1)).toBe(v1);
  });
  it('v2 wins over v1 when both exist', () => {
    const store = fakeStore({
      [SETTINGS_KEY_V1]: JSON.stringify({ excludedPeople: ['OLD'] }),
      [SETTINGS_KEY]: JSON.stringify({ excludedPeople: ['NEW'], venueMerges: [{ match: 'a', name: 'B' }] }),
    });
    const s = loadSettingsFrom(store);
    expect(s.excludedPeople).toEqual(['NEW']);
    expect(s.venueMerges).toEqual([{ match: 'a', name: 'B' }]);
  });
  it('falls back to empty defaults for no data or corrupt JSON', () => {
    expect(loadSettingsFrom(fakeStore())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettingsFrom(fakeStore({ [SETTINGS_KEY]: '{nope' }))).toEqual(DEFAULT_SETTINGS);
  });
  it('defaults contain no personal values', () => {
    expect(DEFAULT_SETTINGS).toEqual({ excludedPeople: [], extraBars: [], extraFood: [], venueMerges: [] });
  });
});

describe('sanitizeSettings', () => {
  it('drops malformed entries', () => {
    const s = sanitizeSettings({
      excludedPeople: ['A', 3, ''],
      extraFood: 'x',
      venueMerges: [{ match: 'm', name: 'n' }, { match: 'm' }, null, { match: ' ', name: 'n' }],
    });
    expect(s).toEqual({ excludedPeople: ['A'], extraBars: [], extraFood: [], venueMerges: [{ match: 'm', name: 'n' }] });
  });
});
