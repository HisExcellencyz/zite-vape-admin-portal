import { useEffect, useState } from 'react';
import { updateOrder, addPayment } from 'zitejs/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { DatePicker } from '@project/components/ui/date-picker';
import { Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DocDownload, { SalesDoc } from '@project/components/documents';
import { format } from 'date-fns';
import { money, orderCode, STAGES, Status, printInvoice, Order } from '../lib/util';

const METHODS = ['Bank Transfer', 'Mobile Money', 'Card', 'Cash'] as const;

function PaymentForm({ order, onDone }: { order: Order; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('Bank Transfer');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = n > 0 && !!date;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await addPayment({ orderId: order.id, amount: n, method, date: format(date!, 'yyyy-MM-dd') });
      toast.success(`Payment recorded · ${r.paymentStatus}`);
      setAmount('');
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="bg-muted rounded-lg p-3 space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Amount</Label><Input type="number" min={0} value={amount} placeholder={String(order.balance)} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><Label className="text-xs">Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Payment date</Label><DatePicker value={date} onChange={setDate} /></div>
      {amount && n <= 0 && <p className="text-xs text-destructive">Enter an amount greater than zero.</p>}
      <Button className="w-full" disabled={!valid || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Record payment</Button>
    </div>
  );
}

export default function OrderDrawer({ order, onClose, onChanged }: { order: Order | null; onClose: () => void; onChanged: () => void }) {
  const [tracking, setTracking] = useState('');
  useEffect(() => setTracking(order?.tracking ?? ''), [order?.id, order?.tracking]);

  const save = async (patch: { status?: Status; trackingNumber?: string }) => {
    try { await updateOrder({ id: order!.id, ...patch }); toast.success('Order updated'); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {order && (
          <>
            <SheetHeader><SheetTitle><span className="font-mono">{orderCode(order.orderId)}</span> · {order.customerName}</SheetTitle></SheetHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div><Label className="text-xs">Status</Label>
                <Select value={order.status} onValueChange={(v) => save({ status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Tracking number</Label>
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} onBlur={() => tracking !== order.tracking && save({ trackingNumber: tracking })} placeholder="Add tracking…" />
              </div>
            </div>
            <h3 className="text-sm font-medium mt-6 mb-2">Items</h3>
            {order.lines.map((l, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border py-2">
                <span><span className="font-mono text-xs text-muted-foreground mr-2">{l.sku}</span>{l.name} × {l.quantity}</span><span>{money(l.quantity * l.unitPrice)}</span>
              </div>
            ))}
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Total</span><span className="font-semibold">{money(order.total)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span>{money(order.paid)}</span></div>
              <div className="flex justify-between"><span>Balance</span><span className="font-semibold text-secondary">{money(order.balance)}</span></div>
            </div>
            <h3 className="text-sm font-medium mt-6">Payments · {order.paymentStatus}</h3>
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-border py-2"><span>{p.date ?? '—'} · {p.method}</span><span>{money(p.amount)}</span></div>
            ))}
            {order.balance > 0 && <PaymentForm order={order} onDone={onChanged} />}
            <div className="grid grid-cols-2 gap-2 mt-6">
              {(['Quote', 'Invoice'] as const).map((kind) => (
                <DocDownload key={kind} variant={kind === 'Invoice' ? 'default' : 'outline'} className="w-full" doc={(): SalesDoc => ({
                  kind, number: orderCode(order.orderId), date: order.datePlaced ? new Date(order.datePlaced) : new Date(),
                  customer: { name: order.customerName, email: order.customerEmail, address: order.customerAddress },
                  lines: order.lines.map((l) => ({ sku: l.sku, name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })), paid: order.paid,
                })} />
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-2" onClick={() => printInvoice(order)}><Printer className="h-4 w-4 mr-2" />Print invoice</Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
