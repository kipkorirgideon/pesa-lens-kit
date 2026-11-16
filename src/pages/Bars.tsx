import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalysis } from '../state';
import { COLORS, dateLabel, hourLabel, ksh, monthLabel, monthShort, num, pct, short } from '../lib/format';
import { ChartCard, Kpi, Legend, PageTitle, Section, Takeaway } from '../components/ui';
import { MoneyTooltip, axisProps, chartData, gridProps } from '../components/chart';
import { DataTable, type Column } from '../components/DataTable';
import type { FbCatRow, FbNightRow, FbVenueRow } from '../lib/types';

const SERIES = [
  { key: 'bars', name: 'Bars & lounges', color: COLORS.orange },
  { key: 'food', name: 'Restaurants, hotels & food', color: COLORS.blue },
  { key: 'meat', name: 'Butcheries & nyama choma', color: COLORS.gray },
] as const;

const seriesOf = SERIES.map((s) => ({ name: s.name, get: (r: Record<typeof s.key, number>) => r[s.key] }));

const catCols: Column<FbCatRow>[] = [
  { key: 'category', header: 'Category', value: (r) => r.category },
  { key: 'amount', header: 'Total', value: (r) => r.amount, render: (r) => ksh(r.amount), align: 'right' },
  { key: 'payments', header: 'Payments', value: (r) => r.payments, render: (r) => num(r.payments), align: 'right' },
  { key: 'venues', header: 'Venues', value: (r) => r.venues, render: (r) => num(r.venues), align: 'right' },
  { key: 'avg', header: 'Average', value: (r) => r.avg, render: (r) => ksh(r.avg), align: 'right' },
  { key: 'weekend_pct', header: 'Weekend', value: (r) => r.weekend_pct, render: (r) => pct(r.weekend_pct), align: 'right' },
  {
    key: 'late_pct',
    header: 'After 10 PM',
    value: (r) => r.late_pct,
    render: (r) => pct(r.late_pct),
    align: 'right',
    cellClass: (r) => (r.late_pct >= 40 ? 'text-red-600' : ''),
  },
];
const venueCols: Column<FbVenueRow>[] = [
  { key: 'rank', header: '#', value: (r) => r.rank, align: 'right' },
  { key: 'venue', header: 'Venue', value: (r) => r.venue },
  { key: 'category', header: 'Category', value: (r) => r.category },
  { key: 'amount', header: 'Total', value: (r) => r.amount, render: (r) => ksh(r.amount), align: 'right' },
  { key: 'visits', header: 'Payments', value: (r) => r.visits, render: (r) => num(r.visits), align: 'right' },
  { key: 'avg', header: 'Average', value: (r) => r.avg, render: (r) => ksh(r.avg), align: 'right' },
  { key: 'late', header: 'Late (after 10 PM)', value: (r) => r.late, render: (r) => num(r.late), align: 'right' },
  { key: 'first', header: 'First', value: (r) => r.first, render: (r) => dateLabel(r.first) },
  { key: 'last', header: 'Last', value: (r) => r.last, render: (r) => dateLabel(r.last) },
];
const nightCols: Column<FbNightRow>[] = [
  { key: 'night', header: 'Night of', value: (r) => r.night, render: (r) => dateLabel(r.night) },
  { key: 'day', header: 'Day', value: (r) => r.day },
  { key: 'amount', header: 'Spent', value: (r) => r.amount, render: (r) => ksh(r.amount), align: 'right', cellClass: () => 'font-medium' },
  { key: 'payments', header: 'Payments', value: (r) => r.payments, render: (r) => num(r.payments), align: 'right' },
  { key: 'venues', header: 'Venues', value: (r) => r.venues, wrap: true },
];

function Stacked<T extends object>({
  data,
  xKey,
  tickFormatter,
  labelFormatter,
  countKey,
  interval,
}: {
  data: T[];
  xKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts passes arbitrary tick values
  tickFormatter?: (v: any) => string;
  labelFormatter?: (l: string | number) => string;
  countKey?: string;
  interval?: number | 'preserveStartEnd';
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} {...axisProps} tickFormatter={tickFormatter} interval={interval} minTickGap={8} />
        <YAxis {...axisProps} tickFormatter={short} width={48} />
        <Tooltip
          cursor={{ fill: '#f3f4f6' }}
          content={<MoneyTooltip totalLabel="Total" labelFormatter={labelFormatter} countKey={countKey} />}
        />
        {SERIES.map((s, i) => (
          <Bar
            isAnimationActive={false}
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="a"
            fill={s.color}
            radius={i === SERIES.length - 1 ? [2, 2, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Bars() {
  const a = useAnalysis();
  const fb = a.fb;
  const s = fb.summary;
  const barCat = fb.cats.find((c) => c.category === 'Bars & lounges');

  return (
    <div className="space-y-6">
      <PageTitle
        title="Bars & restaurants"
        subtitle={
          <>
            Food and drink paid by till or paybill. Missing a bar?{' '}
            <Link to="/settings" className="underline decoration-gray-300 underline-offset-2 hover:text-gray-800">
              Tag it in Settings
            </Link>
            .
          </>
        }
      />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="Total food & drink" value={ksh(s.total)} sub={`${num(s.payments)} payments · ${num(s.venues)} venues`} />
        <Kpi label="Bars & lounges" value={ksh(s.bars)} tone={s.bars > 0 ? 'red' : 'default'} sub={`${num(s.bar_nights)} nights out`} />
        <Kpi label="Per month" value={ksh(s.per_month)} sub={`${pct(s.share_of_till)} of till spending`} />
        <Kpi label="Biggest night" value={ksh(s.biggest_night)} />
      </div>
      <Takeaway>
        You spent <b>{ksh(s.total)}</b> on food and drink — about {ksh(s.per_month)} a month.{' '}
        <span className="text-red-600">{ksh(s.bars)}</span> of it went to bars and lounges over {num(s.bar_nights)} nights
        {barCat && barCat.late_pct > 0 && <>, {pct(barCat.late_pct)} of it after 10 PM</>}.
      </Takeaway>
      <Legend items={SERIES.map((x) => ({ color: x.color, label: x.name }))} />

      <DataTable rows={fb.cats} columns={catCols} rowKey={(r) => r.category} filename="mpesa-food-drink-categories" />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="By year" height={240} data={chartData(fb.yearly, (r) => String(r.year), 'Year', seriesOf, 'years')}>
          <Stacked data={fb.yearly} xKey="year" countKey="payments" />
        </ChartCard>
        <ChartCard
          title="By night of the week"
          subtitle="Payments before 05:00 count toward the previous night."
          height={240}
          data={chartData(fb.dow, (r) => r.day, 'Day', seriesOf, 'days of the week')}
        >
          <Stacked data={fb.dow} xKey="day" countKey="count" />
        </ChartCard>
        <ChartCard title="By hour" height={240} data={chartData(fb.hour, (r) => hourLabel(r.hour), 'Hour', seriesOf, 'hours of the day')}>
          <Stacked
            data={fb.hour}
            xKey="hour"
            countKey="count"
            interval={2}
            tickFormatter={(h: number) => String(h).padStart(2, '0')}
            labelFormatter={(l) => `${hourLabel(Number(l))}–${String(Number(l)).padStart(2, '0')}:59`}
          />
        </ChartCard>
        <ChartCard title="By month" height={240} data={chartData(fb.monthly, (r) => monthLabel(r.month), 'Month', seriesOf, 'months')}>
          <Stacked data={fb.monthly} xKey="month" tickFormatter={monthShort} labelFormatter={(l) => monthLabel(String(l))} />
        </ChartCard>
      </div>

      <Section title="Top venues">
        <DataTable
          rows={fb.venues}
          columns={venueCols}
          rowKey={(r) => r.venue + r.category}
          filename="mpesa-food-drink-venues"
          searchable
          searchPlaceholder="Search venues…"
          initialSort={{ key: 'rank', dir: 'asc' }}
        />
      </Section>
      <Section title="Biggest nights out">
        <DataTable
          rows={fb.nights}
          columns={nightCols}
          rowKey={(r) => r.night}
          filename="mpesa-biggest-nights"
          initialSort={{ key: 'amount', dir: 'desc' }}
        />
      </Section>
    </div>
  );
}
