import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** Value used for sorting, searching and CSV. */
  value: (r: T) => string | number | null | undefined;
  /** Optional custom cell rendering. */
  render?: (r: T) => ReactNode;
  align?: 'left' | 'right';
  /** Extra classes for the cell (e.g. red text). */
  cellClass?: (r: T) => string;
  /** Header title tooltip. */
  hint?: string;
  sortable?: boolean;
  /** Wrap long text (default: no wrap). */
  wrap?: boolean;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T, i: number) => string;
  /** CSV file name without extension. */
  filename: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  maxHeight?: number;
  toolbar?: ReactNode;
  empty?: string;
  /** Re-number a "rank"-like column after sort? No — ranks stay as provided. */
  caption?: ReactNode;
  /** Accessible name for the table; defaults to a phrase derived from `filename`. */
  label?: string;
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  filename,
  searchable,
  searchPlaceholder,
  initialSort,
  maxHeight = 520,
  toolbar,
  empty,
  caption,
  label,
}: Props<T>) {
  const tableLabel = label ?? filename.replace(/^mpesa-/, '').replace(/-/g, ' ');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);

  const shown = useMemo(() => {
    let out = rows;
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((r) =>
        columns.some((c) => {
          const v = c.value(r);
          return v != null && String(v).toLowerCase().includes(needle);
        }),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const m = sort.dir === 'asc' ? 1 : -1;
        out = [...out].sort((a, b) => {
          const va = col.value(a),
            vb = col.value(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m;
          return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * m;
        });
      }
    }
    return out;
  }, [rows, columns, q, sort]);

  const onSort = (c: Column<T>) => {
    if (c.sortable === false) return;
    setSort((s) => {
      if (s?.key === c.key) return { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      const sample = rows.length ? c.value(rows[0]) : null;
      return { key: c.key, dir: typeof sample === 'number' ? 'desc' : 'asc' };
    });
  };

  const csv = () =>
    downloadCsv(
      filename,
      columns.map((c) => c.header),
      shown.map((r) => columns.map((c) => c.value(r))),
    );

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {toolbar}
        {searchable && (
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search…'}
            aria-label={searchPlaceholder?.replace(/…$/, '') ?? `Search ${tableLabel}`}
            className="h-8 min-w-0 flex-1 basis-40 rounded-md border border-gray-300 px-2.5 text-sm sm:max-w-xs"
          />
        )}
        <span role="status" className="ml-auto text-xs text-gray-500">
          {shown.length === rows.length ? `${shown.length} rows` : `${shown.length} of ${rows.length}`}
        </span>
        <button
          type="button"
          onClick={csv}
          className="h-8 rounded-md border border-gray-300 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Download CSV
        </button>
      </div>
      {caption && <div className="mb-2 text-xs text-gray-500">{caption}</div>}
      <div
        tabIndex={0}
        role="region"
        aria-label={`${tableLabel} (scrollable)`}
        className="overflow-auto rounded-md border border-gray-200"
        style={{ maxHeight }}
      >
        <table aria-label={tableLabel} className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    title={c.hint}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortable === false ? undefined : 'none'}
                    className={`sticky top-0 z-10 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.sortable === false ? (
                      c.header
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSort(c)}
                        className={`inline-flex items-center gap-1 hover:text-gray-900 ${active ? 'text-gray-900' : ''}`}
                      >
                        {c.header}
                        <span aria-hidden className="w-3 text-xs text-gray-500">
                          {active ? (sort!.dir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-gray-500">
                  {empty ?? 'Nothing to show.'}
                </td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={rowKey(r, i)} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-1.5 align-top ${c.wrap ? 'min-w-[14rem]' : 'whitespace-nowrap'} ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.cellClass?.(r) ?? ''}`}
                  >
                    {c.render ? c.render(r) : (c.value(r) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
