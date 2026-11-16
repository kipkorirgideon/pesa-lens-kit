import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, useAnalysis } from '../state';
import { COLORS, ksh, normName, num, pct, titleCase } from '../lib/format';
import { ChartCard, Legend, PageTitle, Section, SEVERITY_TEXT, SeverityLabel } from '../components/ui';
import { MoneyTooltip, axisProps } from '../components/chart';
import { DataTable, type Column } from '../components/DataTable';
import type { DrainBarRow, DrainPersonRow, Flag } from '../lib/types';

function fmtValue(f: Flag): string {
  const isMoney = /^\s*KSh\b/i.test(f.unit);
  if (isMoney) return ksh(f.value);
  return Number.isInteger(f.value) ? num(f.value) : num(f.value, 1);
}
function unitText(f: Flag): string {
  return f.unit.replace(/^KSh\s*/i, '').trim();
}

function FlagCard({ f }: { f: Flag }) {
  return (
    <article className="min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <SeverityLabel severity={f.severity} />
      </div>
      <h3 className={`mt-1 text-[15px] font-semibold leading-snug ${f.severity === 'High' ? 'text-red-600' : 'text-gray-900'}`}>{f.title}</h3>
      <div className="mt-1 tabular-nums">
        <span className={`text-lg font-semibold ${SEVERITY_TEXT[f.severity]}`}>{fmtValue(f)}</span>{' '}
        {unitText(f) && <span className="text-sm text-gray-500">{unitText(f)}</span>}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{f.detail}</p>
    </article>
  );
}

const warn = (s: string) => (s ? <span className="text-red-600">{s}</span> : <span className="text-gray-400">—</span>);

const barCols: Column<DrainBarRow>[] = [
  { key: 'rank', header: '#', value: (r) => r.rank, align: 'right' },
  { key: 'venue', header: 'Venue', value: (r) => r.venue },
  { key: 'total', header: 'Total', value: (r) => r.total, render: (r) => ksh(r.total), align: 'right' },
  { key: 'payments', header: 'Payments', value: (r) => r.payments, render: (r) => num(r.payments), align: 'right' },
  { key: 'nights', header: 'Nights', value: (r) => r.nights, render: (r) => num(r.nights), align: 'right' },
  { key: 'per_night', header: 'Per night', value: (r) => r.per_night, render: (r) => ksh(r.per_night), align: 'right' },
  { key: 'last_12m', header: 'Last 12 m', value: (r) => r.last_12m, render: (r) => ksh(r.last_12m), align: 'right', cellClass: (r) => (r.last_12m > r.prev_12m ? 'text-red-600' : '') },
  { key: 'prev_12m', header: 'Prior 12 m', value: (r) => r.prev_12m, render: (r) => ksh(r.prev_12m), align: 'right' },
  { key: 'late_pct', header: 'After 10 PM', value: (r) => r.late_pct, render: (r) => pct(r.late_pct), align: 'right' },
  { key: 'biggest_night', header: 'Biggest night', value: (r) => r.biggest_night, render: (r) => ksh(r.biggest_night), align: 'right' },
  { key: 'flags', header: 'Warning signs', value: (r) => r.flags, render: (r) => warn(r.flags), wrap: true },
];

export default function Flags() {
  const a = useAnalysis();
  const { settings } = useApp();
  const excluded = useMemo(() => new Set(settings.excludedPeople.map(normName)), [settings.excludedPeople]);
  // Defensive: the analysis already leaves excluded people out; never show them here even if it didn't.
  const people = useMemo(() => a.drains.people.filter((p) => !excluded.has(normName(p.name))), [a.drains.people, excluded]);
  const bars = a.drains.bars;
  const barChart = useMemo(() => [...bars].sort((x, y) => y.last_12m + y.prev_12m - (x.last_12m + x.prev_12m)).slice(0, 10), [bars]);
  const counts = { High: 0, Medium: 0, Low: 0 } as Record<Flag['severity'], number>;
  a.flags.forEach((f) => { counts[f.severity]++; });

  const personCols: Column<DrainPersonRow>[] = [
    { key: 'rank', header: '#', value: (r) => r.rank, align: 'right' },
    { key: 'name', header: 'Name', value: (r) => r.name, render: (r) => (r.name === r.name.toUpperCase() ? titleCase(r.name) : r.name) },
    { key: 'phone', header: 'Phone', value: (r) => r.phone },
    { key: 'net_out', header: 'Net out', value: (r) => r.net_out, render: (r) => ksh(r.net_out), align: 'right', cellClass: () => 'text-red-600 font-medium' },
    { key: 'sent', header: 'Sent', value: (r) => r.sent, render: (r) => ksh(r.sent), align: 'right' },
    { key: 'sends', header: 'Sends', value: (r) => r.sends, render: (r) => num(r.sends), align: 'right' },
    { key: 'received', header: 'Received back', value: (r) => r.received, render: (r) => ksh(r.received), align: 'right' },
    { key: 'returned_pct', header: 'Returned', value: (r) => r.returned_pct, render: (r) => pct(r.returned_pct), align: 'right' },
    { key: 'sent_12m', header: 'Sent last 12 m', value: (r) => r.sent_12m, render: (r) => ksh(r.sent_12m), align: 'right', cellClass: (r) => (r.sent_12m > r.sent_prev_12m ? 'text-red-600' : '') },
    { key: 'sent_prev_12m', header: 'Prior 12 m', value: (r) => r.sent_prev_12m, render: (r) => ksh(r.sent_prev_12m), align: 'right' },
    { key: 'largest_send', header: 'Largest send', value: (r) => r.largest_send, render: (r) => ksh(r.largest_send), align: 'right' },
    { key: 'months_active', header: 'Months active', value: (r) => r.months_active, align: 'right' },
    { key: 'flags', header: 'Warning signs', value: (r) => r.flags, render: (r) => warn(r.flags), wrap: true },
  ];

  return (
    <div className="space-y-8">
      <PageTitle title="Red flags & drains"
        subtitle={<><span className="text-red-600">{counts.High} high</span> · <span className="text-amber-600">{counts.Medium} medium</span> · <span className="text-gray-500">{counts.Low} low</span></>} />

      <Section title="Red flags">
        {a.flags.length === 0 ? <p className="text-sm text-gray-500">No red flags found.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {a.flags.map((f) => <FlagCard key={f.id} f={f} />)}
          </div>
        )}
      </Section>

      <Section title="Biggest money drains: bars" subtitle="Bars and lounges ranked by total spent. “Last 12 months” counts back from your latest transaction.">
        {bars.length > 0 && (
          <ChartCard title="Last 12 months vs the 12 months before" subtitle={<Legend items={[{ color: COLORS.red, label: 'Last 12 months' }, { color: COLORS.gray, label: 'Prior 12 months' }]} />} height={Math.max(200, barChart.length * 38 + 30)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChart} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={1}>
                <CartesianGrid stroke="#eef0f3" horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={(v: number) => (v >= 1000 ? Math.round(v / 1000) + 'k' : String(v))} />
                <YAxis type="category" dataKey="venue" {...axisProps} width={130} interval={0} tick={{ fontSize: 11, fill: '#374151' }}
                  tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + '…' : v)} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} content={<MoneyTooltip countKey="payments" />} />
                <Bar isAnimationActive={false} dataKey="last_12m" name="Last 12 months" fill={COLORS.red} barSize={10} />
                <Bar isAnimationActive={false} dataKey="prev_12m" name="Prior 12 months" fill={COLORS.gray} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <DataTable rows={bars} columns={barCols} rowKey={(r) => r.venue} filename="mpesa-drains-bars" searchable searchPlaceholder="Search venues…" initialSort={{ key: 'rank', dir: 'asc' }}
          empty="No bar spending found. You can tag payees as bars in Settings." />
      </Section>

      <Section title="Biggest money drains: people"
        subtitle={<>People you sent at least KSh 10,000 more than you got back.{' '}
          {settings.excludedPeople.length > 0 && <>Left out on purpose: {settings.excludedPeople.map(titleCase).join(', ')} (<Link to="/settings" className="underline decoration-gray-300 underline-offset-2 hover:text-gray-800">change</Link>).</>}</>}>
        <DataTable rows={people} columns={personCols} rowKey={(r) => r.name + r.phone} filename="mpesa-drains-people" searchable searchPlaceholder="Search people…" initialSort={{ key: 'rank', dir: 'asc' }} />
      </Section>
    </div>
  );
}
