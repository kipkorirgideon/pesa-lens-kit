import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { BUILD_TARGET } from '../../vite.config';

/**
 * ADR-009: browserslist (eslint-plugin-compat) and build.target (esbuild) must state the same floor.
 *
 * Coverage, exactly:
 *  - chrome / edge / firefox / safari: browserslist == BUILD_TARGET (esbuild has these targets).
 *  - ios_saf: esbuild has no iOS target, so it is pinned to the Safari floor instead (iOS Safari 14.1 == Safari 14.1).
 *  - ES level: BUILD_TARGET's `esNNNN` == tsconfig `compilerOptions.target`.
 * NOT covered: eslint-plugin-compat only reads browserslist, so an API-level change there is untested beyond
 * these equalities; and `lib` in tsconfig (which types the available APIs) is not compared.
 * If you edit `browserslist`, `BUILD_TARGET` or tsconfig `target`, change all of them together.
 */
const versionOf = (query: string): string | null => /^[a-z_]+ >= (\d+(?:\.\d+)?)$/.exec(query)?.[1] ?? null;

describe('browser target', () => {
  it('browserslist and build.target agree on every engine floor', () => {
    const fromList = pkg.browserslist
      .map((q) => /^(chrome|edge|firefox|safari) >= (\d+(?:\.\d+)?)$/.exec(q))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]}${m[2]}`)
      .sort();
    const fromTarget = BUILD_TARGET.filter((t) => !t.startsWith('es')).sort();
    expect(fromTarget).toEqual(fromList);
  });

  it('ios_saf is pinned to the Safari floor (esbuild has no iOS target)', () => {
    const ios = pkg.browserslist.find((q) => q.startsWith('ios_saf '));
    const safari = pkg.browserslist.find((q) => q.startsWith('safari '));
    expect(ios).toBeDefined();
    expect(safari).toBeDefined();
    expect(versionOf(ios ?? '')).toBe(versionOf(safari ?? ''));
  });

  it('browserslist has no entries beyond the five covered engines', () => {
    const names = pkg.browserslist.map((q) => q.split(' ')[0]).sort();
    expect(names).toEqual(['chrome', 'edge', 'firefox', 'ios_saf', 'safari']);
  });

  it('the ES level matches the tsconfig target', () => {
    const es = BUILD_TARGET.filter((t) => t.startsWith('es'));
    expect(es).toHaveLength(1);
    const tsconfig = readFileSync(new URL('../../tsconfig.json', import.meta.url), 'utf8');
    const target = /"target":\s*"([^"]+)"/.exec(tsconfig)?.[1];
    expect(target?.toLowerCase()).toBe(es[0]);
  });
});
