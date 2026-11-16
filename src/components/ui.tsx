import type { ReactNode } from 'react';
import type { Flag } from '../lib/types';

export function ChartCard({ title, subtitle, children, height = 280, className = '' }: { title: string; subtitle?: ReactNode; children: ReactNode; height?: number | null; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border border-gray-200 bg-white p-3 sm:p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      <div className="mt-3" style={height ? { height } : undefined}>{children}</div>
    </section>
  );
}

export function Section({ title, subtitle, children, actions }: { title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode }) {
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
      <div className="truncate text-xs text-gray-500">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-semibold tabular-nums sm:text-xl ${tone === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-gray-500">{sub}</div>}
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

export function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-md border border-gray-300 p-0.5 text-xs">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded px-2.5 py-1 font-medium ${o.value === value ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SEVERITY_TEXT: Record<Flag['severity'], string> = {
  High: 'text-red-600',
  Medium: 'text-amber-600',
  Low: 'text-gray-500',
};

export function SeverityLabel({ severity }: { severity: Flag['severity'] }) {
  return <span className={`text-xs font-semibold uppercase tracking-wide ${SEVERITY_TEXT[severity]}`}>{severity}</span>;
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}
