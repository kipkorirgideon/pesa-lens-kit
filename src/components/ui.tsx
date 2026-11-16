import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { Flag } from '../lib/types';
import { SEVERITY_TEXT } from './severity';
import { patternElement, patternId } from './patterns';

/** Text alternative for a chart: pre-formatted table cells plus a one-sentence summary. */
export interface ChartData {
  summary: string;
  headers: string[];
  rows: string[][];
}

export function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
  className = '',
  data,
  headingLevel = 3,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  height?: number | null;
  className?: string;
  /** Text alternative: the chart is described by `data.summary` and the same numbers sit in a table below it. */
  data?: ChartData;
  /** Heading level of the title: 2 when the card sits directly under the page h1, 3 inside a Section. */
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section className={`min-w-0 rounded-lg border border-gray-200 bg-white p-3 sm:p-4 ${className}`}>
      <Heading className="text-sm font-semibold text-gray-900">{title}</Heading>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div
        className="mt-3"
        style={height ? { height } : undefined}
        {...(data ? { role: 'img', 'aria-label': `Chart. ${data.summary} The same numbers are in the table below the chart.` } : {})}
      >
        {children}
      </div>
      {data && <ChartTable title={title} data={data} />}
    </section>
  );
}

function ChartTable({ title, data }: { title: string; data: ChartData }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
        View the data behind this chart
        <span className="ml-1 font-normal text-gray-500">(same numbers; works with a keyboard)</span>
      </summary>
      <div
        tabIndex={0}
        role="region"
        aria-label={`Data for ${title}`}
        className="mt-2 max-h-72 overflow-auto rounded-md border border-gray-200"
      >
        <table className="w-full border-collapse text-xs tabular-nums">
          <caption className="sr-only">{data.summary}</caption>
          <thead>
            <tr>
              {data.headers.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`sticky top-0 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600 ${i === 0 ? 'text-left' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, ri) => (
              <tr key={`${ri}-${r[0]}`} className="border-b border-gray-100 last:border-0">
                {r.map((c, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="whitespace-nowrap px-3 py-1 text-left font-normal text-gray-700">
                      {c}
                    </th>
                  ) : (
                    <td key={i} className="whitespace-nowrap px-3 py-1 text-right">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Section({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'default' }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`mt-0.5 break-words text-lg font-semibold tabular-nums sm:text-xl ${tone === 'red' ? 'text-red-600' : 'text-gray-900'}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function Takeaway({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-[15px] leading-relaxed text-gray-700">{children}</p>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

/**
 * Single-select control as a WAI-ARIA radiogroup: the checked radio is the only tab stop (roving
 * tabindex), Left/Up and Right/Down move AND select with wraparound, and focus follows selection.
 */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = options.findIndex((o) => o.value === value);
  // If `value` matches nothing, keep the group reachable by making the first radio the tab stop.
  const stop = checked < 0 ? 0 : checked;

  const select = (i: number) => {
    const n = options.length;
    const next = ((i % n) + n) % n;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(i - 1);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(options.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-md border border-gray-300 p-0.5 text-xs">
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === stop ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`whitespace-nowrap rounded px-2.5 py-1 font-medium ${o.value === value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SeverityLabel({ severity }: { severity: Flag['severity'] }) {
  return <span className={`text-xs font-semibold uppercase tracking-wide ${SEVERITY_TEXT[severity]}`}>{severity}</span>;
}

export function Legend({ items }: { items: { color: string; label: string; pattern?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <Swatch color={i.color} pattern={i.pattern} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Legend key that matches the chart fill: solid, or the same pattern the series uses. */
function Swatch({ color, pattern }: { color: string; pattern?: number }) {
  const uid = useId();
  if (!pattern) return <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />;
  const id = patternId(uid, pattern);
  return (
    <svg aria-hidden="true" focusable="false" width="10" height="10" className="rounded-sm">
      <defs>{patternElement(id, pattern, color)}</defs>
      <rect width="10" height="10" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Non-colour marker for a table cell that is red for a reason: a glyph for sighted monochrome users
 * plus visually hidden text for screen readers. `sr-only` is clip-based, not display:none, so it is announced.
 */
export function Cue({ glyph, text }: { glyph: string; text: string }) {
  return (
    <>
      <span aria-hidden="true" className="ml-1 text-[0.7em]">
        {glyph}
      </span>
      <span className="sr-only">, {text}</span>
    </>
  );
}
