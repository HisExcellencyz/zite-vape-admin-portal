import { useCallback, useEffect, useState } from 'react';
import { getPipeline, addPayment, importPayments, GetPipelineOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import { DatePicker } from '@project/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import DateRange, { Range, inRange } from '@project/components/date-range';
import { money, orderCode, printInvoice, exportRows, pick, num, isoDate } from '../lib/util';
import { Stat, StatSkeletons } from './Pipeline';
import HeaderTools from '../components/HeaderTools';
import SimpleTable from '../components/SimpleTable';
import ExportMenu from '../components/ExportMenu';
import ImportButton from '../components/ImportButton';

type Data = GetPipelineOutputType;
const METHODS = ['Bank Transfer', 'Mobile Money', 'Card', 'Cash'] as const;
type Method = (typeof METHODS)[number];

function AddPaymentDialog({ open, orders, onClose, onSaved }: { open: boolean; orders: Data['orders']; onClose: () => void; onSaved: () => void }) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('Mobile Money');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setOrderId(''); setAmount(''); setReference(''); setDate(new Date()); } }, [open]);
  const order = orders.find((o) => o.id === orderId);
  const valid = !!orderId && Number(amount) > 0 && !!date;

  const submit = async () => {
    setBusy(true);
    try {
      await addPayment({ orderId, amount: Number(amount), method, date: date!.toISOString().slice(0, 10), reference: reference || undefined });
      toast.success('Payment recorded'); onSaved(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Order</Label>
            <Select value={orderId} onValueChange={(v) => { setOrderId(v); const o = orders.find((x) => x.id === v); if (o) setAmount(String(o.balance)); }}>
              <SelectTrigger><SelectValue placeholder="Choose an order…" /></SelectTrigger>
              <SelectContent>{orders.map((o) => <SelectItem key={o.id} value={o.id}>{orderCode(o.orderId)} · {o.customerName} · bal {money(o.balance)}</SelectItem>)}</SelectContent>
            </Select>
            {order && <p className="text-xs text-muted-foreground mt-1">Total {money(order.total)} · Paid {money(order.paid)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (KES)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>Date</Label><DatePicker value={date} onChange={setDate} /></div>
            <div><Label>Reference</Label><Input placeholder="e.g. M-Pesa code" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Payments() {
  const [data, setData] = useState<Data | null>(null);
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<Range>({});
  const load = useCallback(() => getPipeline({}).then(setData).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const payments = (data?.orders ?? []).flatMap((o) => o.payments.filter((p) => inRange(p.date, range)).map((p) => ({ 'Order ID': orderCode(o.orderId), Customer: o.customerName, Reference: p.reference, Date: p.date ?? '', Method: p.method, Amount: p.amount })));
  const doImport = async (rows: Record<string, unknown>[]) => {
    const list = rows.map((r) => ({
      orderNumber: num(pick(r, 'order id', 'order', 'order number')), amount: num(pick(r, 'amount', 'amount paid')),
      method: String(pick(r, 'method', 'payment method') || 'Bank Transfer'), date: isoDate(pick(r, 'date', 'payment date')),
      reference: String(pick(r, 'reference', 'ref')),
    })).filter((p) => p.orderNumber && p.amount > 0);
    if (!list.length) throw new Error('No rows with an Order ID and Amount were found');
    const res = await importPayments({ payments: list });
    toast.success(`Imported ${res.count} payments`);
    if (res.skipped.length) toast.warning(`Skipped (order not found): ${res.skipped.slice(0, 5).join(', ')}`);
    load();
  };

  return (
    <div>
      <PageHeader title="Payments & Receivables" stats={data ? (<>
          <Stat label="Accounts Receivable" value={money(data.totals.receivable)} />
          <Stat label="Deposits Collected" value={money(data.totals.deposits)} />
          <Stat label="Total collected" value={money(data.orders.reduce((s, o) => s + o.paid, 0))} />
        </>) : <StatSkeletons n={3} />}>
          <ImportButton label="Import" templateName="payments" onRows={doImport}
            columns={['Order ID', 'Amount', 'Method', 'Date', 'Reference']}
            hint="Order ID can be written as ORD-0012 or 12. Method: Bank Transfer, Mobile Money, Card or Cash."
            sampleRows={[{ 'Order ID': 'ORD-0001', Amount: 5000, Method: 'Mobile Money', Date: '2026-10-01', Reference: 'QJK12345' }]} />
          <ExportMenu label="Export" disabled={!payments.length} onExport={(f) => exportRows(payments, 'Payments', 'payments', f)} />
          <Button disabled={!data?.orders.length} onClick={() => setAdding(true)} className="bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]"><Plus className="h-4 w-4 mr-2" />Add payment</Button>
      </PageHeader>
      <HeaderTools><DateRange value={range} onChange={setRange} /></HeaderTools>
      <SimpleTable viewKey="payments" rows={(data?.orders ?? []).filter((o) => inRange(o.datePlaced, range) || o.payments.some((p) => inRange(p.date, range)))} loading={!data} searchKeys={['customerName', 'status', 'paymentStatus']}
        cols={[
          { key: 'orderId', label: 'Order', render: (o) => <span className="font-mono">{orderCode(o.orderId)}</span> },
          { key: 'customerName', label: 'Customer' }, { key: 'status', label: 'Status' },
          { key: 'total', label: 'Total', render: (o) => money(o.total) }, { key: 'paid', label: 'Paid', render: (o) => money(o.paid) },
          { key: 'balance', label: 'Balance', render: (o) => money(o.balance) }, { key: 'paymentStatus', label: 'Payment' },
          { key: 'id', label: 'Invoice', render: (o) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); printInvoice(o); }}><Printer className="h-4 w-4" /></Button> },
        ]} />
      <AddPaymentDialog open={adding} orders={data?.orders ?? []} onClose={() => setAdding(false)} onSaved={load} />
    </div>
  );
}
