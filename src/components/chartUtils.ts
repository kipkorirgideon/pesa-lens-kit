// Non-component chart helpers: shared axis/grid props and the chart text-alternative builder.
import { ksh, num } from '../lib/format';
import type { ChartData } from './ui';

export const axisProps = {
  tick: { fontSize: 12, fill: '#6b7280' },
  tickLine: false,
  axisLine: { stroke: '#e5e7eb' },
} as const;

export const gridProps = { stroke: '#eef0f3', vertical: false } as const;

export interface Series<T> {
  name: string;
  get: (r: T) => number;
  /** Defaults to KSh. */
  fmt?: (n: number) => string;
}

/**
 * Builds the text alternative for a chart from the same rows that feed it: one table row per
 * category, one column per series, plus a summary sentence naming the largest category.
 * `label` is the row heading shown in the table; `noun` describes the categories in the summary.
 */
export function chartData<T>(rows: T[], label: (r: T) => string, labelHeader: string, series: Series<T>[], noun: string): ChartData {
  const cells = rows.map((r) => [label(r), ...series.map((s) => (s.fmt ?? ksh)(s.get(r)))]);
  const totals = rows.map((r) => series.reduce((t, s) => t + Math.abs(s.get(r)), 0));
  let top = -1;
  totals.forEach((t, i) => {
    if (top < 0 || t > totals[top]) top = i;
  });
  const names = series.map((s) => s.name.toLowerCase()).join(', ');
  const summary =
    rows.length === 0
      ? `No ${noun} to chart.`
      : `Bar chart of ${names} across ${num(rows.length)} ${noun}. Largest: ${label(rows[top])}, ${ksh(totals[top])} in total.`;
  return { summary, headers: [labelHeader, ...series.map((s) => s.name)], rows: cells };
}
