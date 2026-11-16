import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalysis } from '../state';
import { COLORS, dateLabel, hourLabel, ksh, monthLabel, monthShort, num, short } from '../lib/format';
import { ChartCard, Kpi, Legend, PageTitle, Section, Takeaway } from '../components/ui';
import { MoneyTooltip } from '../components/chart';
import { axisProps, chartData, gridProps } from '../components/chartUtils';
import { DataTable, type Column } from '../components/DataTable';
import type { CategoryRow } from '../lib/types';

const catCols: Column<CategoryRow>[] = [
  { key: 'direction', header: 'Direction', value: (r) => r.direction },
  { key: 'category', header: 'Category', value: (r) => r.category },
  { key: 'amount', header: 'Amount', value: (r) => r.amount, render: (r) => ksh(r.amount), align: 'right' },
  { key: 'count', header: 'Transactions', value: (r) => r.count, render: (r) => num(r.count), align: 'right' },
];

export default function Overview() {
  const a = useAnalysis();
  const s = a.summary;
  const net = s.money_in - s.money_out;
  const months = a.monthly.length;

  const monthly = useMemo(() => a.monthly.map((m) => ({ ...m, fuliza_neg: -m.fuliza })), [a.monthly]);
  const out = useMemo(() => a.categories.filter((c) => c.direction === 'Out').sort((x, y) => y.amount - x.amount), [a.categories]);
  const outTotal = out.reduce((t, c) => t + c.amount, 0);
  const fulizaMonths = a.monthly.filter((m) => m.fuliza > 0).length;
  const peakHour = a.hours.reduce((b, h) => (h.amount > b.amount ? h : b), a.hours[0] ?? { hour: 0, amount: 0, count: 0 });
  const lateAmount = a.hours.filter((h) => h.hour >= 22 || h.hour < 5).reduce((t, h) => t + h.amount, 0);
  const hoursTotal = a.hours.reduce((t, h) => t + h.amount, 0);

  const top = out[0];
  const takeaway = (
    <>
      Over {num(months)} months you received <b>{ksh(s.money_in)}</b> and spent <b>{ksh(s.money_out)}</b>
      {net < 0 ? (
        <>
          {' '}
          — <span className="text-red-600">{ksh(-net)} more out than in</span>
        </>
      ) : (
        <> — {ksh(net)} more in than out</>
      )}
      .
      {top && (
        <>
          {' '}
          The biggest outflow was {top.category.toLowerCase()} ({ksh(top.amount)},{' '}
          {outTotal ? Math.round((top.amount / outTotal) * 100) : 0}%).
        </>
      )}
      {s.fuliza > 0 && (
        <>
          {' '}
          Fuliza covered <span className="text-red-600">{ksh(s.fuliza)}</span> of shortfalls in {fulizaMonths} of {months} months.
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <PageTitle title="Overview" subtitle={`${dateLabel(s.first)} – ${dateLabel(s.last)}`} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Money in" value={ksh(s.money_in)} />
        <Kpi label="Money out" value={ksh(s.money_out)} />
        <Kpi label="Net" value={ksh(net)} tone={net < 0 ? 'red' : 'default'} />
        <Kpi
          label="Fuliza borrowed"
          value={ksh(s.fuliza)}
          tone={s.fuliza > 0 ? 'red' : 'default'}
          sub={`${fulizaMonths} of ${months} months`}
        />
        <Kpi label="Sent to people" value={ksh(s.people_sent)} />
        <Kpi label="Paybills & tills" value={ksh(s.paybill_till)} />
        <Kpi label="Transaction costs" value={ksh(s.tx_cost)} />
        <Kpi label="Transactions" value={num(s.transactions)} sub={`${num(s.transactions / Math.max(1, months))} a month`} />
      </div>
      <Takeaway>{takeaway}</Takeaway>

      <ChartCard
        headingLevel={2}
        title="Money in vs out, by month"
        subtitle={
          <Legend
            items={[
              { color: COLORS.blue, label: 'Money in' },
              { color: COLORS.orange, label: 'Money out' },
              { color: COLORS.red, label: 'Fuliza drawn (below the line)' },
            ]}
          />
        }
        height={300}
        data={chartData(
          a.monthly,
          (r) => monthLabel(r.month),
          'Month',
          [
            { name: 'Money in', get: (r) => r.money_in },
            { name: 'Money out', get: (r) => r.money_out },
            { name: 'Fuliza drawn', get: (r) => r.fuliza },
          ],
          'months',
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={0} stackOffset="sign">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} tickFormatter={monthShort} minTickGap={16} />
            <YAxis {...axisProps} tickFormatter={short} width={48} />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Tooltip
              cursor={{ fill: '#f3f4f6' }}
              content={
                <MoneyTooltip absolute labelFormatter={(l) => monthLabel(String(l))} countKey="fuliza_draws" countLabel="Fuliza draws" />
              }
            />
            <Bar isAnimationActive={false} dataKey="money_in" name="Money in" fill={COLORS.blue} stackId="in" />
            <Bar isAnimationActive={false} dataKey="money_out" name="Money out" fill={COLORS.orange} stackId="out" />
            <Bar isAnimationActive={false} dataKey="fuliza_neg" name="Fuliza drawn" fill={COLORS.red} stackId="out" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          headingLevel={2}
          title="Where the money went"
          subtitle={`All money out: ${ksh(outTotal)}`}
          height={Math.max(220, out.length * 30 + 20)}
          data={chartData(out, (r) => r.category, 'Category', [{ name: 'Amount', get: (r) => r.amount }], 'money-out categories')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={out} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef0f3" horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={short} />
              <YAxis type="category" dataKey="category" {...axisProps} width={136} interval={0} tick={{ fontSize: 12, fill: '#374151' }} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} content={<MoneyTooltip countKey="count" countLabel="transactions" />} />
              <Bar isAnimationActive={false} dataKey="amount" name="Amount" fill={COLORS.orange} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          headingLevel={2}
          title="Payments by hour of day"
          subtitle={
            <>
              Busiest: {hourLabel(peakHour.hour)} ({ksh(peakHour.amount)}). Between 22:00 and 05:00:{' '}
              <span className={hoursTotal && lateAmount / hoursTotal > 0.1 ? 'text-red-600' : ''}>{ksh(lateAmount)}</span>
            </>
          }
          height={260}
          data={chartData(a.hours, (r) => hourLabel(r.hour), 'Hour', [{ name: 'Paid out', get: (r) => r.amount }], 'hours of the day')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.hours} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="hour" {...axisProps} tickFormatter={(h: number) => String(h).padStart(2, '0')} interval={2} />
              <YAxis {...axisProps} tickFormatter={short} width={48} />
              <Tooltip
                cursor={{ fill: '#f3f4f6' }}
                content={
                  <MoneyTooltip
                    labelFormatter={(l) => `${hourLabel(Number(l))}–${String(Number(l)).padStart(2, '0')}:59`}
                    countKey="count"
                  />
                }
              />
              <Bar isAnimationActive={false} dataKey="amount" name="Paid out" fill={COLORS.blue} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Section title="Categories" subtitle="Every money-in and money-out category.">
        <DataTable
          rows={a.categories}
          columns={catCols}
          rowKey={(r) => r.direction + r.category}
          filename="mpesa-categories"
          initialSort={{ key: 'amount', dir: 'desc' }}
        />
      </Section>
    </div>
  );
}
