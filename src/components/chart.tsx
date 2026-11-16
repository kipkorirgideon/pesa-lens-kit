// Shared Recharts bits: axis styling + a tooltip that shows exact KSh values.
import type { ReactNode } from 'react';
import { ksh, num } from '../lib/format';
import type { ChartData } from './ui';

export const axisProps = {
  tick: { fontSize: 12, fill: '#6b7280' },
  tickLine: false,
  axisLine: { stroke: '#e5e7eb' },
} as const;

export const gridProps = { stroke: '#eef0f3', vertical: false } as const;

interface TPayload {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

/**
 * Tooltip content: label + one line per series with exact KSh value.
 * `countKeys` maps a series dataKey → the row field holding its count, to add "(n payments)".
 */
export function MoneyTooltip({
  active,
  payload,
  label,
  labelFormatter,
  countKey,
  countLabel = 'payments',
  absolute,
  totalLabel,
}: {
  active?: boolean;
  payload?: TPayload[];
  label?: string | number;
  labelFormatter?: (l: string | number, row?: Record<string, unknown>) => ReactNode;
  countKey?: string;
  countLabel?: string;
  absolute?: boolean;
  totalLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const items = payload.filter((p) => p.value != null);
  const total = items.reduce((s, p) => s + Math.abs(Number(p.value) || 0), 0);
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-semibold text-gray-900">{labelFormatter && label != null ? labelFormatter(label, row) : label}</div>
      {items.map((p) => {
        const v = Number(p.value) || 0;
        return (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4 tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium text-gray-900">{ksh(absolute ? Math.abs(v) : v)}</span>
          </div>
        );
      })}
      {totalLabel && items.length > 1 && (
        <div className="mt-1 flex justify-between gap-4 border-t border-gray-100 pt-1 tabular-nums">
          <span className="text-gray-600">{totalLabel}</span>
          <span className="font-semibold">{ksh(total)}</span>
        </div>
      )}
      {countKey && row && typeof row[countKey] === 'number' && (
        <div className="mt-1 text-gray-500">
          {num(row[countKey] as number)} {countLabel}
        </div>
      )}
    </div>
  );
}

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
