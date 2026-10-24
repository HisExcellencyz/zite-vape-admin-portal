import { useEffect, useState } from 'react';
import { getDirectory, createOrders, GetDirectoryOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { DatePicker } from '@project/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { money, STAGES } from '../lib/util';

type Dir = GetDirectoryOutputType;
type Line = { productId: string; quantity: number; unitPrice: number };

export default function NewOrderDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [dir, setDir] = useState<Dir | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [status, setStatus] = useState('Submitted');
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerId(''); setLines([]); setStatus('Submitted'); setDate(new Date());
    getDirectory({}).then(setDir).catch((e) => toast.error(e.message));
  }, [open]);

  const prod = (id: string) => dir?.products.find((p) => p.id === id);
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const valid = !!customerId && !!date && lines.length > 0 && lines.every((l) => l.productId && l.quantity > 0 && l.unitPrice >= 0);

  const submit = async () => {
    setBusy(true);
    try {
      await createOrders({ orders: [{ customerId, date: date!.toISOString(), status, lines }] });
      toast.success('Order created'); onSaved(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add order</DialogTitle>
          <DialogDescription>Place an order on behalf of a customer. Stock is deducted and their balance updated.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{dir?.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Date</Label><DatePicker value={date} onChange={setDate} /></div>
          <div><Label>Stage</Label>
            <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Products</Label>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_auto] gap-2 items-center">
              <Select value={l.productId} onValueChange={(v) => setLine(i, { productId: v, unitPrice: prod(v)?.basePrice ?? 0 })}>
                <SelectTrigger><SelectValue placeholder="Product…" /></SelectTrigger>
                <SelectContent>{dir?.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} · {p.name} ({p.stock} left)</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(0, Math.floor(Number(e.target.value))) })} />
              <Input type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} />
              <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" disabled={!dir} onClick={() => setLines([...lines, { productId: '', quantity: 1, unitPrice: 0 }])}><Plus className="h-4 w-4 mr-1" />Add line</Button>
          {lines.length > 0 && <div className="text-xs text-muted-foreground">Qty · Unit price (KES, defaults to selling price)</div>}
        </div>
        <DialogFooter className="items-center">
          <span className="mr-auto font-semibold">Total {money(total)}</span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
