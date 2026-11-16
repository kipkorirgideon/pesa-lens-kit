import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp, useAnalysis } from '../state';
import { COLORS, dateLabel, ksh, normName, num, short, titleCase } from '../lib/format';
import { ChartCard, Legend, PageTitle, Section, Segmented, Takeaway } from '../components/ui';
import { MoneyTooltip, axisProps } from '../components/chart';
import { DataTable, type Column } from '../components/DataTable';
import type { PersonRow } from '../lib/types';

type Mode = 'sent' | 'recv';
type Ranked = PersonRow & { rank: number; display: string };

export default function People() {
  const a = useAnalysis();
  const { settings } = useApp();
  const [mode, setMode] = useState<Mode>('sent');
  const excluded = useMemo(() => new Set(settings.excludedPeople.map(normName)), [settings.excludedPeople]);

  const ranked: Ranked[] = useMemo(() => {
    const key = mode === 'sent' ? 'sent' : 'recv';
    return [...a.people].filter((p) => p[key] > 0).sort((x, y) => y[key] - x[key]).slice(0, 200)
      .map((p, i) => ({ ...p, rank: i + 1, display: titleCase(p.name) }));
  }, [a.people, mode]);

  const chart = useMemo(() => ranked.slice(0, 15).map((p) => ({ name: p.display, sent: -p.sent, recv: p.recv, sent_n: p.sent_n, recv_n: p.recv_n })), [ranked]);

  const totals = useMemo(() => {
    let sent = 0, recv = 0, sentTo = 0;
    for (const p of a.people) { sent += p.sent; recv += p.recv; if (p.sent > 0) sentTo++; }
    return { sent, recv, sentTo };
  }, [a.people]);

  const cols: Column<Ranked>[] = useMemo(() => [
    { key: 'rank', header: '#', value: (r) => r.rank, align: 'right' },
    { key: 'name', header: 'Name', value: (r) => r.display, render: (r) => <>{r.display}{excluded.has(r.name) && <span className="ml-1.5 text-xs text-gray-400">excluded</span>}</> },
    { key: 'phone', header: 'Phone', value: (r) => r.phone },
    { key: 'sent', header: 'Sent', value: (r) => r.sent, render: (r) => ksh(r.sent), align: 'right' },
    { key: 'sent_n', header: 'Sends', value: (r) => r.sent_n, render: (r) => num(r.sent_n), align: 'right' },
    { key: 'recv', header: 'Received', value: (r) => r.recv, render: (r) => ksh(r.recv), align: 'right' },
    { key: 'recv_n', header: 'Receipts', value: (r) => r.recv_n, render: (r) => num(r.recv_n), align: 'right' },
    { key: 'net', header: 'Net', hint: 'Received minus sent', value: (r) => r.net, render: (r) => ksh(r.net), align: 'right',
      cellClass: (r) => (r.net < 0 && !excluded.has(r.name) ? 'text-red-600 font-medium' : 'font-medium') },
    { key: 'cost', header: 'Fees paid', value: (r) => r.cost, render: (r) => ksh(r.cost), align: 'right' },
    { key: 'first', header: 'First', value: (r) => r.first, render: (r) => dateLabel(r.first) },
    { key: 'last', header: 'Last activity', value: (r) => r.last, render: (r) => dateLabel(r.last) },
  ], [excluded]);

  return (
    <div className="space-y-6">
      <PageTitle title="People" subtitle={`${num(a.people.length)} people you sent money to or received from`} />
      <Takeaway>
        You sent <b>{ksh(a.summary.people_sent)}</b> to {num(totals.sentTo)} people and received <b>{ksh(totals.recv)}</b> from people
        {totals.recv < a.summary.people_sent ? <> — <span className="text-red-600">{ksh(a.summary.people_sent - totals.recv)} more went out than came back</span>.</> : '.'}
      </Takeaway>

      <div>
        <Segmented label="Rank people by" value={mode} onChange={setMode}
          options={[{ value: 'sent', label: 'Top 200 by sent' }, { value: 'recv', label: 'Top 200 by received' }]} />
      </div>

      <ChartCard title={`Top 15 by ${mode === 'sent' ? 'money sent' : 'money received'}`}
        subtitle={<Legend items={[{ color: COLORS.orange, label: 'Sent (left)' }, { color: COLORS.blue, label: 'Received (right)' }]} />}
        height={Math.max(260, chart.length * 26 + 30)}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} layout="vertical" stackOffset="sign" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" horizontal={false} />
            <XAxis type="number" {...axisProps} tickFormatter={(v: number) => short(Math.abs(v))} />
            <YAxis type="category" dataKey="name" {...axisProps} width={120} interval={0} tick={{ fontSize: 11, fill: '#374151' }}
              tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + '…' : v)} />
            <ReferenceLine x={0} stroke="#9ca3af" />
            <Tooltip cursor={{ fill: '#f3f4f6' }} content={<MoneyTooltip absolute labelFormatter={(l, row) => <>{l}<div className="font-normal text-gray-500">{num(row?.sent_n as number)} sends · {num(row?.recv_n as number)} receipts</div></>} />} />
            <Bar isAnimationActive={false} dataKey="sent" name="Sent" fill={COLORS.orange} stackId="a" />
            <Bar isAnimationActive={false} dataKey="recv" name="Received" fill={COLORS.blue} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Section title={mode === 'sent' ? 'Top 200 by money sent' : 'Top 200 by money received'}
        subtitle="Net = received minus sent. Negative nets are red, except for people you excluded in Settings.">
        <DataTable key={mode} rows={ranked} columns={cols} rowKey={(r) => r.name} filename={`mpesa-people-top200-by-${mode}`} searchable searchPlaceholder="Search name or phone…"
          initialSort={{ key: 'rank', dir: 'asc' }} />
      </Section>
    </div>
  );
}
