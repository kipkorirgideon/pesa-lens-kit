/**
 * Informational detection of Settings rules that can never change a result. Pure; never alters settings.
 * Normalisation mirrors the engine's prefix matcher in classify.ts: whitespace collapsed, case-insensitive.
 */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toUpperCase();

export interface RuleNote {
  /** Index of the flagged rule in its list. */
  index: number;
  kind: 'duplicate' | 'covered' | 'unreachable';
  /** The rule text that makes this one redundant, as the user typed it. */
  by: string;
  message: string;
}

/** extraBars / extraFood: any match wins, so order is irrelevant. Later duplicates and longer-than-another entries are flagged. */
export function checkExtraList(list: readonly string[]): RuleNote[] {
  const n = list.map(norm);
  const notes: RuleNote[] = [];
  list.forEach((raw, i) => {
    if (n[i] === '') return;
    const dup = n.findIndex((x, j) => j < i && x === n[i]);
    if (dup >= 0) {
      notes.push({
        index: i,
        kind: 'duplicate',
        by: list[dup],
        message: `“${raw}” is redundant: it is the same as “${list[dup]}” apart from capitalisation or spacing.`,
      });
      return;
    }
    const cover = n.findIndex((x, j) => j !== i && x !== '' && x.length < n[i].length && n[i].startsWith(x));
    if (cover >= 0) {
      notes.push({
        index: i,
        kind: 'covered',
        by: list[cover],
        message: `“${raw}” is redundant: the shorter rule “${list[cover]}” already matches every name starting with it.`,
      });
    }
  });
  return notes;
}

/** venueMerges: first match wins, so an earlier rule whose match is a prefix of (or equal to) this one shadows it. */
export function checkMerges(merges: readonly { match: string; name: string }[]): RuleNote[] {
  const n = merges.map((m) => norm(m.match));
  const notes: RuleNote[] = [];
  merges.forEach((m, i) => {
    if (n[i] === '') return;
    const by = n.findIndex((x, j) => j < i && x !== '' && n[i].startsWith(x));
    if (by >= 0) {
      notes.push({
        index: i,
        kind: 'unreachable',
        by: merges[by].match,
        message: `Unreachable: an earlier rule starting with “${merges[by].match}” already matches names starting with “${m.match}”, so this rule never applies.`,
      });
    }
  });
  return notes;
}
