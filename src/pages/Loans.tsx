import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalysis } from '../state';
import { COLORS, dateLabel, ksh, monthLabel, monthShort, num, short } from '../lib/format';
import { ChartCard, Kpi, Legend, PageTitle, Section, Takeaway } from '../components/ui';
import { MoneyTooltip, axisProps, chartData, gridProps } from '../components/chart';
import { DataTable, type Column } from '../components/DataTable';
import type { LoanMonthRow, LoanProductRow } from '../lib/types';

const prodCols: Column<LoanProductRow>[] = [
  { key: 'product', header: 'Product', value: (r) => r.product, cellClass: () => 'font-medium' },
  {
    key: 'borrowed',
    header: 'Borrowed',
    value: (r) => r.borrowed,
    render: (r) => (r.borrowed == null ? 'not in SMS' : ksh(r.borrowed)),
    align: 'right',
  },
  { key: 'borrow_count', header: 'Times borrowed', value: (r) => r.borrow_count, render: (r) => num(r.borrow_count), align: 'right' },
  { key: 'repaid', header: 'Repaid', value: (r) => r.repaid, render: (r) => ksh(r.repaid), align: 'right' },
  { key: 'repay_count', header: 'Repayments', value: (r) => r.repay_count, render: (r) => num(r.repay_count), align: 'right' },
  { key: 'fees', header: 'Fees', value: (r) => r.fees, render: (r) => (r.fees == null ? '—' : ksh(r.fees)), align: 'right' },
  { key: 'first', header: 'First', value: (r) => r.first, render: (r) => dateLabel(r.first) },
  { key: 'last', header: 'Last', value: (r) => r.last, render: (r) => dateLabel(r.last) },
  { key: 'note', header: 'Note', value: (r) => r.note || null, wrap: true, cellClass: () => 'text-gray-500' },
];
const monthCols: Column<LoanMonthRow>[] = [
  { key: 'month', header: 'Month', value: (r) => r.month, render: (r) => monthLabel(r.month) },
  {
    key: 'fuliza',
    header: 'Fuliza drawn',
    value: (r) => r.fuliza,
    render: (r) => ksh(r.fuliza),
    align: 'right',
    cellClass: (r) => (r.fuliza > 0 ? 'text-red-600' : ''),
  },
  { key: 'fuliza_draws', header: 'Draws', value: (r) => r.fuliza_draws, align: 'right' },
  { key: 'fuliza_fees', header: 'Fuliza fees', value: (r) => r.fuliza_fees, render: (r) => ksh(r.fuliza_fees), align: 'right' },
  { key: 'fuliza_repaid', header: 'Fuliza repaid', value: (r) => r.fuliza_repaid, render: (r) => ksh(r.fuliza_repaid), align: 'right' },
  { key: 'kcb_requests', header: 'KCB requests', value: (r) => r.kcb_requests, align: 'right' },
  { key: 'kcb_repaid', header: 'KCB repaid', value: (r) => r.kcb_repaid, render: (r) => ksh(r.kcb_repaid), align: 'right' },
  { key: 'hustler_in', header: 'Hustler borrowed', value: (r) => r.hustler_in, render: (r) => ksh(r.hustler_in), align: 'right' },
  { key: 'hustler_repaid', header: 'Hustler repaid', value: (r) => r.hustler_repaid, render: (r) => ksh(r.hustler_repaid), align: 'right' },
];

export default function Loans() {
  const a = useAnalysis();
  const m = a.loans.monthly;
  const t = useMemo(
    () =>
      m.reduce(
        (s, r) => ({
          fuliza: s.fuliza + r.fuliza,
          kcb: s.kcb + r.kcb_repaid,
          hustler: s.hustler + r.hustler_in,
          req: s.req + r.kcb_requests,
          months: s.months + (r.fuliza + r.kcb_repaid + r.hustler_in > 0 ? 1 : 0),
        }),
        { fuliza: 0, kcb: 0, hustler: 0, req: 0, months: 0 },
      ),
    [m],
  );
  const peak = m.reduce((b, r) => (r.fuliza + r.kcb_repaid + r.hustler_in > b.fuliza + b.kcb_repaid + b.hustler_in ? r : b), m[0]);

  return (
    <div className="space-y-6">
      <PageTitle title="Fuliza & loans" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="Fuliza drawn" value={ksh(t.fuliza)} tone={t.fuliza > 0 ? 'red' : 'default'} />
        <Kpi label="KCB M-PESA repaid" value={ksh(t.kcb)} sub={`${num(t.req)} loan requests`} />
        <Kpi label="Hustler Fund borrowed" value={ksh(t.hustler)} />
        <Kpi
          label="Months with borrowing"
          value={`${num(t.months)} of ${num(m.length)}`}
          tone={m.length && t.months / m.length > 0.5 ? 'red' : 'default'}
        />
      </div>
      <Takeaway>
        You borrowed in{' '}
        <span className={m.length && t.months / m.length > 0.5 ? 'text-red-600' : ''}>
          {num(t.months)} of {num(m.length)} months
        </span>
        : <b>{ksh(t.fuliza)}</b> through Fuliza, <b>{ksh(t.hustler)}</b> from the Hustler Fund, and <b>{ksh(t.kcb)}</b> repaid to KCB
        M-PESA.
        {peak && peak.fuliza + peak.kcb_repaid + peak.hustler_in > 0 && <> The heaviest month was {monthLabel(peak.month)}.</>}
      </Takeaway>

      <ChartCard
        title="Borrowing by month"
        subtitle={
          <Legend
            items={[
              { color: COLORS.red, label: 'Fuliza drawn' },
              { color: COLORS.orange, label: 'KCB M-PESA repayments' },
              { color: COLORS.blue, label: 'Hustler Fund borrowed' },
            ]}
          />
        }
        height={300}
        data={chartData(
          m,
          (r) => monthLabel(r.month),
          'Month',
          [
            { name: 'Fuliza drawn', get: (r) => r.fuliza },
            { name: 'KCB repayments', get: (r) => r.kcb_repaid },
            { name: 'Hustler borrowed', get: (r) => r.hustler_in },
          ],
          'months',
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={m} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} tickFormatter={monthShort} minTickGap={16} />
            <YAxis {...axisProps} tickFormatter={short} width={48} />
            <Tooltip
              cursor={{ fill: '#f3f4f6' }}
              content={
                <MoneyTooltip
                  totalLabel="Total"
                  labelFormatter={(l) => monthLabel(String(l))}
                  countKey="fuliza_draws"
                  countLabel="Fuliza draws"
                />
              }
            />
            <Bar isAnimationActive={false} dataKey="fuliza" name="Fuliza drawn" stackId="a" fill={COLORS.red} />
            <Bar isAnimationActive={false} dataKey="kcb_repaid" name="KCB repayments" stackId="a" fill={COLORS.orange} />
            <Bar
              isAnimationActive={false}
              dataKey="hustler_in"
              name="Hustler borrowed"
              stackId="a"
              fill={COLORS.blue}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Section
        title="By product"
        subtitle="KCB M-PESA loan amounts are not stated in the SMSes, so only requests and repayments are counted."
      >
        <DataTable rows={a.loans.products} columns={prodCols} rowKey={(r) => r.product} filename="mpesa-loan-products" />
      </Section>
      <Section title="Month by month">
        <DataTable
          rows={m}
          columns={monthCols}
          rowKey={(r) => r.month}
          filename="mpesa-loans-monthly"
          initialSort={{ key: 'month', dir: 'desc' }}
          maxHeight={420}
        />
      </Section>
    </div>
  );
}
