import { useEffect, useMemo, useState } from 'react';
import DateRange, { Range, inRange } from '@project/components/date-range';
import { getMyOrders, GetMyOrdersOutputType } from 'zitejs/api';
import { Skeleton } from '@project/components/ui/skeleton';
import { Badge } from '@project/components/ui/badge';
import { money, orderCode } from '../lib/cart';
import { ErrorState } from './Catalog';
import OrderDetail from '../components/OrderDetail';

type Order = GetMyOrdersOutputType['orders'][0];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile tile shrink-0">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default function MyOrders() {
  const [data, setData] = useState<GetMyOrdersOutputType | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [range, setRange] = useState<Range>({});
  const orders = useMemo(() => (data?.orders ?? []).filter((o) => inRange(o.datePlaced, range)), [data, range]);

  useEffect(() => {
    getMyOrders({}).then(setData).catch((e) => setError(e.message || 'Could not load orders'));
  }, []);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="page-header sticky top-[4.5rem] z-10 -mt-4 px-4 sm:px-5 py-3 rounded-2xl border mb-4 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold text-gradient">My Orders</h1><div className="flex gap-2 overflow-x-auto flex-1">{data ? (<><Stat label="Pending balance" value={money(data.totals.pending)} /><Stat label="Payments & deposits" value={money(data.totals.deposits)} /><Stat label="Open orders" value={String(data.totals.open)} /></>) : <Skeleton className="h-11 w-64" />}</div><DateRange value={range} onChange={setRange} /></div>
      <div className="bg-card border border-border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr>{['Order', 'Placed', 'Status', 'Total', 'Paid', 'Balance', 'Payment', 'Tracking'].map((h) => <th key={h} className="text-left p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => setSelected(o)} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/60">
                <td className="p-3 font-mono">{orderCode(o.orderId)}</td>
                <td className="p-3">{o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : '—'}</td>
                <td className="p-3"><Badge variant="outline">{o.status}</Badge></td>
                <td className="p-3">{money(o.total)}</td>
                <td className="p-3">{money(o.paid)}</td>
                <td className="p-3">{money(o.balance)}</td>
                <td className="p-3">{o.paymentStatus}</td>
                <td className="p-3 font-mono text-xs">{o.tracking || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && orders.length === 0 && <div className="p-8 text-center text-muted-foreground">{data.orders.length ? 'No orders between these dates.' : 'No orders yet.'}</div>}
      </div>
      {data && <OrderDetail order={selected} company={data.company} onClose={() => setSelected(null)} />}
    </div>
  );
}
