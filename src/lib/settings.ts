// Settings persistence helpers (pure; storage is injected so tests need no DOM).
import { DEFAULT_SETTINGS, type Settings } from './types';

export const SETTINGS_KEY = 'mpesa.settings.v2';
export const SETTINGS_KEY_V1 = 'mpesa.settings.v1';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

/** Coerce unknown stored JSON into a valid Settings; missing/invalid fields become empty. */
export function sanitizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const merges = Array.isArray(s.venueMerges) ? s.venueMerges : [];
  return {
    excludedPeople: strings(s.excludedPeople),
    extraBars: strings(s.extraBars),
    extraFood: strings(s.extraFood),
    venueMerges: merges.flatMap((m: unknown) => {
      const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
      return typeof o.match === 'string' && typeof o.name === 'string' && o.match.trim() && o.name.trim()
        ? [{ match: o.match, name: o.name }]
        : [];
    }),
  };
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Load v2 settings. If v2 is absent or unparseable, migrate v1 (excludedPeople/extraBars kept, new fields empty)
 * and write the result to v2, overwriting any corrupt v2 value. v1 is left untouched.
 */
export function loadSettingsFrom(store: Store): Settings {
  let v2: string | null = null;
  try {
    v2 = store.getItem(SETTINGS_KEY);
    if (v2) return sanitizeSettings(JSON.parse(v2));
  } catch {
    /* corrupt v2 (or unavailable storage): fall through to v1 */
  }
  let result: Settings | null = null;
  try {
    const v1 = store.getItem(SETTINGS_KEY_V1);
    if (v1) result = sanitizeSettings(JSON.parse(v1));
  } catch {
    /* corrupt v1: ignore */
  }
  if (result) {
    saveSettingsTo(store, result);
    return result;
  }
  // Corrupt v2 and nothing to migrate: replace the junk so it is not re-parsed on every load.
  if (v2) saveSettingsTo(store, DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function saveSettingsTo(store: Store, s: Settings): void {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: keep in memory */
  }
}
