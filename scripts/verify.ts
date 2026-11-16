// Runs parse + analyze on the real backup (local file, never sent anywhere) and compares with reference/expected/*.json.
// Usage: npx tsx scripts/verify.ts [path-to-backup]
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBackup } from '../src/lib/parse';
import { analyze } from '../src/lib/analyze';
import { sanitizeSettings } from '../src/lib/settings';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP = process.argv.slice(2).find((x) => !x.startsWith('-')) ?? 'backups/sms.sms';
const TOL = 1; // KSh rounding tolerance
type Row = Record<string, unknown>;
const expected = (n: string): Row[] => JSON.parse(readFileSync(join(ROOT, 'reference/expected', n + '.json'), 'utf8')).rows;

// Personal settings the golden data was generated with: git-ignored reference/settings.json (Settings shape), else empty defaults.
const settingsPath = join(ROOT, 'reference/settings.json');
const SETTINGS = sanitizeSettings(existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, 'utf8')) : {});
console.log(existsSync(settingsPath) ? 'settings: reference/settings.json' : 'settings: empty defaults (no reference/settings.json)');

const t0 = Date.now();
const pr = parseBackup(JSON.parse(readFileSync(BACKUP, 'utf8')));
const t1 = Date.now();
const a = analyze(pr, SETTINGS);
const t2 = Date.now();

function same(x: unknown, y: unknown): boolean {
  if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) <= TOL + 1e-9;
  if (x === null || y === null || x === undefined || y === undefined) return (x ?? null) === (y ?? null);
  return String(x) === String(y);
}

let failed = 0;
/** Compare rows by key; only the listed fields (default: every field in expected except ignored). */
function check(
  section: string,
  got: Row[],
  exp: Row[],
  opts: { key?: (r: Row) => string; fields?: string[]; ignore?: string[]; allowExtra?: boolean } = {},
) {
  const key = opts.key ?? ((r: Row, i?: number) => String(i));
  const gm = new Map<string, Row>();
  got.forEach((r, i) => gm.set((key as (r: Row, i: number) => string)(r, i), r));
  const errs: string[] = [];
  exp.forEach((e, i) => {
    const k = (key as (r: Row, i: number) => string)(e, i);
    const g = gm.get(k);
    if (!g) {
      errs.push(`missing ${k}`);
      return;
    }
    for (const f of opts.fields ?? Object.keys(e).filter((f) => !(opts.ignore ?? []).includes(f))) {
      if (!same(g[f], e[f])) errs.push(`${k}.${f}: got ${JSON.stringify(g[f])} want ${JSON.stringify(e[f])}`);
    }
  });
  if (!opts.allowExtra && got.length !== exp.length) errs.push(`row count: got ${got.length} want ${exp.length}`);
  const ok = errs.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${section.padEnd(16)} ${exp.length} rows${ok ? '' : `, ${errs.length} mismatches`}`);
  for (const e of errs.slice(0, 5)) console.log('        ' + e);
}

const byIdx = (r: Row, i?: number) => String(i);
check('summary', [a.summary as unknown as Row], expected('summary'), { ignore: ['people'] });
check('monthly', a.monthly as unknown as Row[], expected('monthly'), { key: (r) => String(r.month) });
check('categories', a.categories as unknown as Row[], expected('categories'), { key: (r) => `${r.direction}|${r.category}` });
check('hours', a.hours as unknown as Row[], expected('hours'), { key: (r) => String(r.hour) });
check('people', a.people as unknown as Row[], expected('people'), {
  key: (r) => String(r.name),
  fields: ['sent', 'sent_n', 'recv', 'recv_n', 'net'],
  allowExtra: true,
});
check('payees', a.payees as unknown as Row[], expected('paybill_till_v2'), {
  key: (r) => String(r.key),
  fields: ['amount', 'count'],
  allowExtra: true,
});
check('biz_dow', a.biz.dow as unknown as Row[], expected('biz_dow'), { key: (r) => String(r.day) });
check('biz_hour', a.biz.hour as unknown as Row[], expected('biz_hour'), { key: (r) => String(r.hour) });
check('biz_parts', a.biz.parts as unknown as Row[], expected('biz_parts'), { key: (r) => String(r.part) });
check('fb_summary', [a.fb.summary as unknown as Row], expected('fb_summary'));
check('fb_cats', a.fb.cats as unknown as Row[], expected('fb_cats'), { key: (r) => String(r.category) });
check('fb_venues', a.fb.venues as unknown as Row[], expected('fb_venues'), { key: byIdx });
check('fb_yearly', a.fb.yearly as unknown as Row[], expected('fb_yearly'), { key: (r) => String(r.year) });
check('fb_dow', a.fb.dow as unknown as Row[], expected('fb_dow'), { key: (r) => String(r.day) });
check('drain_bars', a.drains.bars as unknown as Row[], expected('drain_bars'), { key: byIdx });
check('drain_people', a.drains.people as unknown as Row[], expected('drain_people'), {
  key: byIdx,
  fields: ['rank', 'name', 'net_out', 'flags'],
  allowExtra: true,
});
check('loans_monthly', a.loans.monthly as unknown as Row[], expected('loans_monthly'), { key: (r) => String(r.month) });
check('loans_products', a.loans.products as unknown as Row[], expected('loans_products'), { key: (r) => String(r.product) });
check('flags', a.flags as unknown as Row[], expected('flags'), { key: byIdx, fields: ['id', 'severity', 'value'] });

console.log(`\n${pr.txns.length} txns from ${pr.counters.totalSms} SMS; parse ${t1 - t0} ms, analyze ${t2 - t1} ms`);
console.log(failed ? `${failed} section(s) FAILED` : 'ALL SECTIONS PASS');
if (process.argv.includes('--details'))
  for (const f of a.flags) console.log(`- [${f.severity}] ${f.id} = ${f.value} ${f.unit}\n    ${f.detail}`);
process.exitCode = failed ? 1 : 0;
