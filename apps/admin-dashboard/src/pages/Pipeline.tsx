import { useCallback, useEffect, useState } from 'react';
import { getPipeline, updateOrder, createOrders, GetPipelineOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import ExportMenu from '../components/ExportMenu';
import ImportButton from '../components/ImportButton';
import NewOrderDialog from '../components/NewOrderDialog';
import SimpleTable, { ViewToggle } from '../components/SimpleTable';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import HeaderTools from '../components/HeaderTools';
import DateRange, { Range, inRange } from '@project/components/date-range';
import { money, orderCode, STAGES, Status, exportOrders, exportRows, orderRows, Order, pick, num, isoDate } from '../lib/util';
import OrderDrawer from '../components/OrderDrawer';

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div data-tone={tone === 'good' ? 'green' : tone === 'bad' ? 'bad' : undefined} className="stat-tile tile shrink-0">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone === 'bad' ? '!text-destructive' : ''}`}>{value}</div>
    </div>
  );
}
export const StatSkeletons = ({ n }: { n: number }) => <>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-12 w-36 shrink-0 rounded-2xl" />)}</>;

export default function Pipeline() {
  const [data, setData] = useState<GetPipelineOutputType | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<Range>({});
  const shown = (data?.orders ?? []).filter((o) => inRange(o.datePlaced, range));
  const [view, setViewState] = useState<'list' | 'grid'>(() => (localStorage.getItem('view-pipeline') as 'list' | 'grid') || 'grid');
  const setView = (v: 'list' | 'grid') => { setViewState(v); localStorage.setItem('view-pipeline', v); };

  const load = useCallback(() => getPipeline({}).then(setData).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const move = async (id: string, status: Status) => {
    if (!data) return;
    const prev = data;
    setData({ ...data, orders: data.orders.map((o) => (o.id === id ? { ...o, status } : o)) });
    try {
      await updateOrder({ id, status });
      load();
    } catch {
      setData(prev);
      toast.error('Could not move order');
    }
  };

  const doImport = async (rows: Record<string, unknown>[]) => {
    const groups = new Map<string, { customerEmail: string; date: string; status: string; lines: { sku: string; quantity: number; unitPrice?: number }[] }>();
    rows.forEach((r, i) => {
      const ref = String(pick(r, 'order ref', 'order reference', 'order') || `row-${i}`);
      const g = groups.get(ref) ?? { customerEmail: String(pick(r, 'customer email', 'customer', 'contact email')), date: isoDate(pick(r, 'date', 'date placed')), status: String(pick(r, 'status') || 'Submitted'), lines: [] };
      const price = pick(r, 'unit price', 'price');
      g.lines.push({ sku: String(pick(r, 'sku')), quantity: num(pick(r, 'quantity', 'qty')), unitPrice: price === '' ? undefined : num(price) });
      groups.set(ref, g);
    });
    const res = await createOrders({ orders: [...groups.values()] });
    toast.success(`Imported ${res.count} orders`);
    if (res.skipped.length) toast.warning(`Skipped ${res.skipped.length}: ${res.skipped.slice(0, 3).join('; ')}`);
    load();
  };

  const open = data?.orders.find((o) => o.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="All Orders" stats={data ? (<>
            <Stat label="Accounts Receivable" value={money(data.totals.receivable)} />
            <Stat label="Deposits Collected" value={money(data.totals.deposits)} />
            <Stat label="Orders in progress" value={String(data.totals.inProgress)} />
          </>) : <StatSkeletons n={3} />}>
          <ImportButton label="Import" templateName="orders" onRows={doImport}
            columns={['Order Ref', 'Customer Email', 'Date', 'Status', 'SKU', 'Quantity', 'Unit Price']}
            hint="One row per product (SKU); rows sharing an Order Ref become one order. Status: Submitted, Awaiting Deposit, Processing or Completed. Leave Unit Price blank to use the selling price."
            sampleRows={[
              { 'Order Ref': 'A1', 'Customer Email': 'buyer@example.co.ke', Date: '2026-10-01', Status: 'Submitted', SKU: 'GS-001', Quantity: 10, 'Unit Price': '' },
              { 'Order Ref': 'A1', 'Customer Email': 'buyer@example.co.ke', Date: '2026-10-01', Status: 'Submitted', SKU: 'GS-002', Quantity: 5, 'Unit Price': 900 },
            ]} />
          <ExportMenu label="Export" disabled={!data?.orders.length}
            onExport={(f) => (f === 'xlsx' ? exportOrders(shown) : exportRows(orderRows(shown), 'Orders', 'orders', f))} />
          <Button onClick={() => setAdding(true)} className="bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]"><Plus className="h-4 w-4 mr-2" />Add order</Button>
      </PageHeader>
      <HeaderTools><DateRange value={range} onChange={setRange} /><span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">{view === 'grid' ? 'Board' : 'List'}<ViewToggle view={view} onChange={setView} /></span></HeaderTools>
      {view === 'list' ? (
        <SimpleTable noViewToggle viewKey="pipeline-list" rows={shown} loading={!data} searchKeys={['customerName', 'status', 'paymentStatus']} onOpen={(o) => setOpenId(o.id)}
          cols={[
            { key: 'orderId', label: 'Order', render: (o) => <span className="font-mono">{orderCode(o.orderId)}</span> },
            { key: 'customerName', label: 'Customer' },
            { key: 'datePlaced', label: 'Date', render: (o) => (o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : '') },
            { key: 'status', label: 'Stage', render: (o) => STAGES.find((s) => s.status === o.status)?.label ?? o.status },
            { key: 'total', label: 'Total', render: (o) => money(o.total) },
            { key: 'balance', label: 'Balance', render: (o) => money(o.balance) },
            { key: 'paymentStatus', label: 'Payment' },
          ]} />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {STAGES.map((s) => {
          const cards = shown.filter((o) => o.status === s.status);
          return (
            <div key={s.status}
              onDragOver={(e) => { e.preventDefault(); setOver(s.status); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); const id = e.dataTransfer.getData('text/plain'); const o = data?.orders.find((x) => x.id === id); if (o && o.status !== s.status) move(id, s.status); }}
              className={`rounded-lg p-3 min-h-[300px] transition-colors ${over === s.status ? 'bg-primary/30 ring-1 ring-ring' : 'bg-muted'}`}>
              <div className="text-sm font-medium mb-3 flex justify-between"><span>{s.label}</span><span className="text-muted-foreground">{cards.length}</span></div>
              <div className="space-y-2">
                {!data && <Skeleton className="h-20" />}
                {cards.map((o) => <Card key={o.id} o={o} onOpen={() => setOpenId(o.id)} />)}
              </div>
            </div>
          );
        })}
      </div>
      )}
      <NewOrderDialog open={adding} onClose={() => setAdding(false)} onSaved={load} />
      <OrderDrawer order={open} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}

function Card({ o, onOpen }: { o: Order; onOpen: () => void }) {
  return (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', o.id)} onClick={onOpen}
      className="bg-card border border-border rounded-md p-3 text-sm cursor-grab active:cursor-grabbing hover:border-ring/60 transition-colors">
      <div className="flex justify-between"><span className="font-mono text-xs">{orderCode(o.orderId)}</span><span className="text-xs text-muted-foreground">{o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : ''}</span></div>
      <div className="font-medium mt-1">{o.customerName}</div>
      <div className="text-muted-foreground text-xs mt-1">{money(o.total)} · <span className={o.paymentStatus === 'Fully Paid' ? 'text-secondary' : ''}>{o.paymentStatus}</span></div>
    </div>
  );
}
