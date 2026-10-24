import { GetMyOrdersOutputType } from 'zitejs/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Button } from '@project/components/ui/button';
import { Printer } from 'lucide-react';
import { money, orderCode } from '../lib/cart';
import DocDownload from '@project/components/documents';

type Order = GetMyOrdersOutputType['orders'][0];
type Company = GetMyOrdersOutputType['company'];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function printInvoice(o: Order, c: Company) {
  const rows = o.lines.map((l) => `<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td class="r">${l.quantity}</td><td class="r">${money(l.unitPrice)}</td><td class="r">${money(l.quantity * l.unitPrice)}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Invoice ${orderCode(o.orderId)}</title><style>
    body{font-family:Montserrat,Helvetica,Arial,sans-serif;color:#111;padding:40px}table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}.r{text-align:right}h1{margin:0}.muted{color:#666;font-size:13px}
    .tot{margin-top:16px;margin-left:auto;width:260px}.tot div{display:flex;justify-content:space-between;padding:4px 0}</style></head><body>
    <h1>Invoice ${orderCode(o.orderId)}</h1><div class="muted">${o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : ''}</div>
    <p><strong>${esc(c.name)}</strong><br/><span class="muted">${esc(c.address).replace(/\n/g, '<br/>')}<br/>${esc(c.email)}</span></p>
    <table><thead><tr><th>SKU</th><th>Product</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot"><div><span>Total</span><strong>${money(o.total)}</strong></div><div><span>Paid</span><span>${money(o.paid)}</span></div><div><span>Balance due</span><strong>${money(o.balance)}</strong></div></div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export default function OrderDetail({ order, company, onClose }: { order: Order | null; company: Company; onClose: () => void }) {
  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {order && (
          <>
            <SheetHeader><SheetTitle className="font-mono">{orderCode(order.orderId)}</SheetTitle></SheetHeader>
            <div className="text-sm text-muted-foreground mt-1">{order.status} · {order.paymentStatus}{order.tracking && ` · Tracking ${order.tracking}`}</div>
            <h3 className="text-sm font-medium mt-6 mb-2">Items</h3>
            <div className="space-y-2">
              {order.lines.map((l, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border pb-2">
                  <span><span className="font-mono text-xs text-muted-foreground mr-2">{l.sku}</span>{l.name} × {l.quantity}</span>
                  <span>{money(l.quantity * l.unitPrice)}</span>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-medium mt-6 mb-2">Payments</h3>
            {order.payments.length === 0 && <div className="text-sm text-muted-foreground">No payments recorded yet.</div>}
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-border pb-2">
                <span>{p.date ?? '—'} · {p.method}</span><span>{money(p.amount)}</span>
              </div>
            ))}
            <div className="mt-6 space-y-1 text-sm">
              <div className="flex justify-between"><span>Total</span><span className="font-semibold">{money(order.total)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span>{money(order.paid)}</span></div>
              <div className="flex justify-between"><span>Balance due</span><span className="font-semibold text-secondary">{money(order.balance)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <DocDownload className="w-full" doc={() => ({ kind: 'Invoice', number: orderCode(order.orderId), date: order.datePlaced ? new Date(order.datePlaced) : new Date(),
                customer: { name: company.name, email: company.email, address: company.address }, lines: order.lines, paid: order.paid })} />
              <Button variant="outline" className="w-full" onClick={() => printInvoice(order, company)}><Printer className="h-4 w-4 mr-2" />Print</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
