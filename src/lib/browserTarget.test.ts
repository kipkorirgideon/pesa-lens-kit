import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import { BUILD_TARGET } from '../../vite.config';

/** ADR-009: browserslist (eslint-plugin-compat) and build.target (esbuild) must state the same floor. */
describe('browser target', () => {
  it('browserslist and build.target agree on every engine floor', () => {
    const fromList = pkg.browserslist
      .map((q) => /^(chrome|edge|firefox|safari) >= (\d+)$/.exec(q))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]}${m[2]}`)
      .sort();
    const fromTarget = BUILD_TARGET.filter((t) => !t.startsWith('es')).sort();
    expect(fromTarget).toEqual(fromList);
  });
});
