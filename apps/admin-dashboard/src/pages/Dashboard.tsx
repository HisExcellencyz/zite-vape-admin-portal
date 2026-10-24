import { useCallback, useEffect, useState } from 'react';
import { getDashboard, GetDashboardOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import DateRange, { Range, toDay } from '@project/components/date-range';
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import { money } from '../lib/util';
import { Stat, StatSkeletons } from './Pipeline';

const kes = (v: number) => `KES ${Math.round(v).toLocaleString()}`;
const tip = { contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }, formatter: (v: unknown) => money(Number(v)) };

export default function Dashboard() {
  const [range, setRange] = useState<Range>(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return { from: d, to: new Date() }; });
  const [data, setData] = useState<GetDashboardOutputType | null>(null);
  const load = useCallback(() => { setData(null); getDashboard({ from: toDay(range.from), to: toDay(range.to) }).then(setData).catch((e) => toast.error(e.message)); }, [range]);
  useEffect(() => { load(); }, [load]);

  const t = data?.totals;
  return (
    <div className="space-y-6 [&>*:first-child]:mb-0">
      <PageHeader title="Dashboard" subtitle="Profit & loss · RRP never used" stats={t ? (<>
          <Stat label="Net profit / loss" value={money(t.netProfit)} tone={t.netProfit >= 0 ? 'good' : 'bad'} />
          <Stat label={`Sales · ${t.orders} orders`} value={money(t.revenue)} />
          <Stat label="Cost of goods" value={money(t.cogs)} />
          <Stat label={`Gross profit · ${t.grossMargin.toFixed(1)}%`} value={money(t.grossProfit)} />
          <Stat label="Expenses" value={money(t.expenses)} />
          <Stat label="Collected" value={money(t.collected)} />
          <Stat label="Uncollected" value={money(Math.max(0, t.revenue - t.collected))} />
        </>) : <StatSkeletons n={7} />}>
        <DateRange value={range} onChange={setRange} />
      </PageHeader>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card border border-border rounded-lg p-4">
          <div className="section-title text-sm font-semibold mb-3">Monthly profit & loss</div>
          {!data ? <Skeleton className="h-72" /> : data.monthly.length === 0 ? <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">No transactions in this period.</div> : (
            <ResponsiveContainer width="100%" height={288}>
              <ComposedChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Sales" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Line dataKey="netProfit" name="Net profit" stroke="hsl(var(--chart-4))" strokeWidth={2.5} dot />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div>
            <div className="section-title text-sm font-semibold mb-2">Top products</div>
            {!data ? <Skeleton className="h-28" /> : data.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : data.topProducts.map((p) => (
              <div key={p.name} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                <span className="truncate mr-2">{p.name} <span className="text-muted-foreground">×{p.qty}</span></span>
                <span className="text-right whitespace-nowrap">{kes(p.revenue)}<span className="block text-xs text-muted-foreground">profit {kes(p.profit)}</span></span>
              </div>
            ))}
          </div>
          <div>
            <div className="section-title text-sm font-semibold mb-2">Expenses by category</div>
            {!data ? <Skeleton className="h-28" /> : data.expenseByCategory.length === 0 ? <p className="text-sm text-muted-foreground">No expenses logged.</p> : (
              <ResponsiveContainer width="100%" height={Math.max(80, data.expenseByCategory.length * 30)}>
                <BarChart data={data.expenseByCategory} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide /><YAxis type="category" dataKey="category" fontSize={11} width={70} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tip} /><Bar dataKey="amount" name="Amount" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
