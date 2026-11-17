import { describe, expect, it } from 'vitest';
import { checkExtraList, checkMerges } from './ruleCheck';

describe('checkMerges', () => {
  it('flags a rule shadowed by an earlier shorter prefix and names it', () => {
    const notes = checkMerges([
      { match: 'Zed', name: 'Zed' },
      { match: 'Zed Corner', name: 'Zed Corner' },
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ index: 1, kind: 'unreachable', by: 'Zed' });
    expect(notes[0].message).toContain('earlier rule starting with “Zed”');
  });
  it('flags an equal match, ignoring case and spacing', () => {
    expect(
      checkMerges([
        { match: 'zed  corner', name: 'A' },
        { match: 'ZED CORNER', name: 'B' },
      ]).map((x) => x.index),
    ).toEqual([1]);
  });
  it('does not flag the longer rule when it comes first, or distinct rules', () => {
    expect(
      checkMerges([
        { match: 'Zed Corner', name: 'A' },
        { match: 'Zed', name: 'B' },
      ]),
    ).toEqual([]);
    expect(
      checkMerges([
        { match: 'Zed', name: 'A' },
        { match: 'Quux', name: 'B' },
      ]),
    ).toEqual([]);
  });
});

describe('checkExtraList', () => {
  it('flags case and whitespace variant duplicates', () => {
    expect(checkExtraList(['zed corn', 'ZED CORN'])).toMatchObject([{ index: 1, kind: 'duplicate', by: 'zed corn' }]);
    expect(checkExtraList(['zed corn', ' Zed   Corn '])).toHaveLength(1);
  });
  it('flags an entry covered by a shorter prefix, in either order', () => {
    expect(checkExtraList(['Zed', 'Zed Corner'])).toMatchObject([{ index: 1, kind: 'covered', by: 'Zed' }]);
    expect(checkExtraList(['Zed Corner', 'Zed'])).toMatchObject([{ index: 0, kind: 'covered', by: 'Zed' }]);
  });
  it('does not flag distinct entries or mid-name fragments', () => {
    expect(checkExtraList(['Zed Corner', 'Quux Bar', 'Corner'])).toEqual([]);
  });
});
