import { useId, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalysis } from '../state';
import { COLORS, dateLabel, hourLabel, ksh, num, pct, short } from '../lib/format';
import { patternDefs, patternFill } from '../components/patterns';
import { ChartCard, Legend, PageTitle, Section, Segmented, Takeaway } from '../components/ui';
import { MoneyTooltip } from '../components/chart';
import { axisProps, chartData, gridProps } from '../components/chartUtils';
import { DataTable, type Column } from '../components/DataTable';
import type { BizDayTopRow, BizGridRow, BizPartRow, PayeeRow } from '../lib/types';

type Filter = 'all' | 'Paybill' | 'Till / Buy Goods';
type Ranked = PayeeRow & { rank: number };

const payeeCols: Column<Ranked>[] = [
  { key: 'rank', header: '#', value: (r) => r.rank, align: 'right' },
  { key: 'name', header: 'Payee', value: (r) => r.name },
  { key: 'type', header: 'Type', value: (r) => r.type, render: (r) => (r.type === 'Paybill' ? 'Paybill' : 'Till') },
  { key: 'amount', header: 'Total paid', value: (r) => r.amount, render: (r) => ksh(r.amount), align: 'right' },
  { key: 'count', header: 'Payments', value: (r) => r.count, render: (r) => num(r.count), align: 'right' },
  { key: 'avg', header: 'Average', value: (r) => r.avg, render: (r) => ksh(r.avg), align: 'right' },
  { key: 'cost', header: 'Fees', value: (r) => r.cost, render: (r) => ksh(r.cost), align: 'right' },
  { key: 'top_account', header: 'Main account', value: (r) => r.top_account || null },
  { key: 'first', header: 'First', value: (r) => r.first, render: (r) => dateLabel(r.first) },
  { key: 'last', header: 'Last', value: (r) => r.last, render: (r) => dateLabel(r.last) },
];

const partCols: Column<BizPartRow>[] = [
  { key: 'part', header: 'Time of day', value: (r) => r.part },
  { key: 'total', header: 'Total', value: (r) => r.total, render: (r) => ksh(r.total), align: 'right' },
  { key: 'share', header: 'Share', value: (r) => r.share, render: (r) => pct(r.share), align: 'right' },
  { key: 'count', header: 'Payments', value: (r) => r.count, render: (r) => num(r.count), align: 'right' },
  { key: 'paybill', header: 'Paybill', value: (r) => r.paybill, render: (r) => ksh(r.paybill), align: 'right' },
  { key: 'till', header: 'Till', value: (r) => r.till, render: (r) => ksh(r.till), align: 'right' },
];

const dayTopCols: Column<BizDayTopRow>[] = [
  { key: 'day', header: 'Day', value: (r) => r.day },
  { key: 'rank', header: 'Rank', value: (r) => r.rank, align: 'right' },
  { key: 'name', header: 'Payee', value: (r) => r.name },
  { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => ksh(r.amount), align: 'right' },
];

const paySeries = [
  { name: 'Paybill', get: (r: { paybill: number }) => r.paybill },
  { name: 'Till', get: (r: { till: number }) => r.till },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function HeatMap({ grid }: { grid: BizGridRow[] }) {
  const byKey = useMemo(() => {
    const m = new Map<string, BizGridRow>();
    grid.forEach((g) => m.set(`${g.day}|${g.hour}`, g));
    return m;
  }, [grid]);
  const days = useMemo(() => {
    const seen = [...new Map(grid.map((g) => [g.day, g.day_no])).entries()].sort((x, y) => x[1] - y[1]).map((x) => x[0]);
    return seen.length ? seen : DAYS;
  }, [grid]);
  const max = Math.max(1, ...grid.map((g) => g.total));
  const peak = grid.reduce<BizGridRow | null>((b, g) => (g.total > (b?.total ?? 0) ? g : b), null);
  const summary = peak
    ? `Heat map of payments by weekday and hour. The busiest slot is ${peak.day} ${hourLabel(peak.hour)}, ${ksh(peak.total)} across ${num(peak.count)} payments. Weekday totals are in the chart above and time-of-day totals in the table below.`
    : 'Heat map of payments by weekday and hour. There are no payments to show.';
  return (
    <div className="overflow-x-auto">
      <div
        role="img"
        aria-label={summary}
        className="grid min-w-[640px] gap-[2px]"
        style={{ gridTemplateColumns: '2.25rem repeat(24, minmax(0, 1fr))' }}
      >
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-xs text-gray-500">
            {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
          </div>
        ))}
        {days.map((d) => (
          <div key={d} className="contents">
            <div className="flex items-center text-xs text-gray-600">{d}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const c = byKey.get(`${d}|${h}`);
              const t = c?.total ?? 0;
              const op = t > 0 ? 0.08 + 0.92 * Math.sqrt(t / max) : 0;
              return (
                <div
                  key={h}
                  className="aspect-square rounded-[2px] bg-gray-50"
                  title={`${d} ${hourLabel(h)}–${String(h).padStart(2, '0')}:59: ${ksh(t)} · ${num(c?.count ?? 0)} payments`}
                >
                  <div className="h-full w-full rounded-[2px]" style={{ background: COLORS.blue, opacity: op }} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        Less
        {[0.1, 0.3, 0.55, 0.8, 1].map((o) => (
          <span key={o} className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: COLORS.blue, opacity: o }} />
        ))}
        More · hover or tap a cell for the exact amount
      </div>
    </div>
  );
}

export default function Payees() {
  const pid = useId();
  const a = useAnalysis();
  const [filter, setFilter] = useState<Filter>('all');
  const ranked: Ranked[] = useMemo(
    () =>
      a.payees
        .filter((p) => filter === 'all' || p.type === filter)
        .sort((x, y) => y.amount - x.amount)
        .slice(0, 100)
        .map((p, i) => ({ ...p, rank: i + 1 })),
    [a.payees, filter],
  );

  const tot = useMemo(() => {
    let pb = 0,
      till = 0;
    a.payees.forEach((p) => {
      if (p.type === 'Paybill') pb += p.amount;
      else till += p.amount;
    });
    return { pb, till };
  }, [a.payees]);
  const busiestDay = a.biz.dow.reduce((b, d) => (d.total > b.total ? d : b), a.biz.dow[0] ?? { day: '—', total: 0 });
  const topPart = a.biz.parts.reduce((b, p) => (p.total > b.total ? p : b), a.biz.parts[0] ?? { part: '—', total: 0, share: 0 });

  return (
    <div className="space-y-6">
      <PageTitle title="Paybills & tills" subtitle={`${num(a.payees.length)} businesses paid`} />
      <Takeaway>
        You paid <b>{ksh(tot.pb)}</b> through paybills and <b>{ksh(tot.till)}</b> at tills.
        {busiestDay && (
          <>
            {' '}
            {busiestDay.day} is the biggest paying day ({ksh(busiestDay.total)});{' '}
          </>
        )}
        {topPart && (
          <>
            most money goes out in the {topPart.part.replace(/\s*\d.*$/, '').toLowerCase()} ({pct(topPart.share)}).
          </>
        )}
      </Takeaway>

      <Section
        title="Top 100 payees"
        actions={
          <Segmented
            label="Payee type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'Paybill', label: 'Paybill' },
              { value: 'Till / Buy Goods', label: 'Till' },
            ]}
          />
        }
      >
        <DataTable
          key={filter}
          rows={ranked}
          columns={payeeCols}
          rowKey={(r) => r.key}
          filename={`mpesa-payees-top100-${filter === 'all' ? 'all' : filter === 'Paybill' ? 'paybill' : 'till'}`}
          searchable
          searchPlaceholder="Search payees or accounts…"
          initialSort={{ key: 'rank', dir: 'asc' }}
        />
      </Section>

      <Section
        title="When you pay"
        subtitle={
          <Legend
            items={[
              { color: COLORS.blue, label: 'Paybill' },
              { color: COLORS.orange, label: 'Till', pattern: 1 },
            ]}
          />
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="By day of the week"
            height={240}
            data={chartData(a.biz.dow, (r) => r.day, 'Day', paySeries, 'days of the week')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.biz.dow} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                {patternDefs(`${pid}-dow`, [COLORS.blue, COLORS.orange])}
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={short} width={48} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} content={<MoneyTooltip totalLabel="Total" countKey="count" />} />
                <Bar
                  isAnimationActive={false}
                  dataKey="paybill"
                  name="Paybill"
                  stackId="a"
                  fill={patternFill(`${pid}-dow`, 0, COLORS.blue)}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="till"
                  name="Till"
                  stackId="a"
                  fill={patternFill(`${pid}-dow`, 1, COLORS.orange)}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard
            title="By hour of the day"
            height={240}
            data={chartData(a.biz.hour, (r) => hourLabel(r.hour), 'Hour', paySeries, 'hours of the day')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.biz.hour} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                {patternDefs(`${pid}-hour`, [COLORS.blue, COLORS.orange])}
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="hour" {...axisProps} tickFormatter={(h: number) => String(h).padStart(2, '0')} interval={2} />
                <YAxis {...axisProps} tickFormatter={short} width={48} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  content={
                    <MoneyTooltip
                      totalLabel="Total"
                      countKey="count"
                      labelFormatter={(l) => `${hourLabel(Number(l))}–${String(Number(l)).padStart(2, '0')}:59`}
                    />
                  }
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="paybill"
                  name="Paybill"
                  stackId="a"
                  fill={patternFill(`${pid}-hour`, 0, COLORS.blue)}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="till"
                  name="Till"
                  stackId="a"
                  fill={patternFill(`${pid}-hour`, 1, COLORS.orange)}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="Day × hour" subtitle="Darker = more money paid to paybills and tills in that hour." height={null}>
          <HeatMap grid={a.biz.grid} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold">Time of day</h3>
            <DataTable rows={a.biz.parts} columns={partCols} rowKey={(r) => r.part} filename="mpesa-payees-time-of-day" />
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold">Top 3 payees per weekday</h3>
            <DataTable
              rows={a.biz.dayTop}
              columns={dayTopCols}
              rowKey={(r) => r.key}
              filename="mpesa-payees-top3-per-weekday"
              maxHeight={360}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
