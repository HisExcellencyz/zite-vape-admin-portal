import * as XLSX from 'xlsx';
import type { GetPipelineOutputType } from 'zitejs/api';

export type Order = GetPipelineOutputType['orders'][0];

export const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'KES' });
export const orderCode = (n: number) => `ORD-${String(n).padStart(4, '0')}`;
export const STAGES = [
  { status: 'Submitted', label: 'New' },
  { status: 'Awaiting Deposit', label: 'Awaiting Deposit' },
  { status: 'Processing', label: 'Fulfillment' },
  { status: 'Completed', label: 'Completed' },
] as const;
export type Status = (typeof STAGES)[number]['status'];

export function downloadXlsx(rows: Record<string, unknown>[], sheet: string, file: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${file}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportOrders(orders: Order[]) {
  const summary = orders.map((o) => ({
    'Order ID': orderCode(o.orderId), Customer: o.customerName,
    'Date Placed': o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : '',
    Status: o.status, 'Total Value': o.total, 'Amount Paid': o.paid, Balance: o.balance,
    'Payment Status': o.paymentStatus, Tracking: o.tracking,
  }));
  const lines = orders.flatMap((o) => o.lines.map((l) => ({
    'Order ID': orderCode(o.orderId), Customer: o.customerName, SKU: l.sku, Product: l.name,
    Quantity: l.quantity, 'Unit Price': l.unitPrice, 'Line Total': l.quantity * l.unitPrice,
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Orders');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lines), 'Line Items');
  XLSX.writeFile(wb, `orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function printInvoice(o: Order) {
  const rows = o.lines.map((l) => `<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td class="r">${l.quantity}</td><td class="r">${money(l.unitPrice)}</td><td class="r">${money(l.quantity * l.unitPrice)}</td></tr>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Invoice ${orderCode(o.orderId)}</title><style>
    body{font-family:Montserrat,Helvetica,Arial,sans-serif;color:#111;padding:40px}table{width:100%;border-collapse:collapse;margin-top:24px}
    th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}.r{text-align:right}h1{margin:0}.muted{color:#666;font-size:13px}
    .tot{margin-top:16px;margin-left:auto;width:260px}.tot div{display:flex;justify-content:space-between;padding:4px 0}</style></head><body>
    <h1>Invoice ${orderCode(o.orderId)}</h1><div class="muted">${o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : ''} · ${esc(o.status)}</div>
    <p><strong>Bill to: ${esc(o.customerName)}</strong><br/><span class="muted">${esc(o.customerAddress).replace(/\n/g, '<br/>')}<br/>${esc(o.customerEmail)}</span></p>
    <table><thead><tr><th>SKU</th><th>Product</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot"><div><span>Total</span><strong>${money(o.total)}</strong></div><div><span>Paid</span><span>${money(o.paid)}</span></div><div><span>Balance due</span><strong>${money(o.balance)}</strong></div></div>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export type Fmt = 'csv' | 'xlsx';

export function exportRows(rows: Record<string, unknown>[], title: string, file: string, fmt: Fmt) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (fmt === 'xlsx') return downloadXlsx(rows, title.slice(0, 30), file);
  {
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${file}-${stamp}.csv`;
    a.click();
    return;
  }
}

export function orderRows(orders: Order[]) {
  return orders.map((o) => ({
    'Order ID': orderCode(o.orderId), Customer: o.customerName,
    'Date Placed': o.datePlaced ? new Date(o.datePlaced).toLocaleDateString() : '',
    Status: o.status, 'Total Value': o.total, 'Amount Paid': o.paid, Balance: o.balance,
    'Payment Status': o.paymentStatus, Tracking: o.tracking,
  }));
}

/** Read a column value from an imported row by any of several header names (case-insensitive). */
export const pick = (r: Record<string, unknown>, ...keys: string[]) => {
  const k = Object.keys(r).find((x) => keys.includes(x.trim().toLowerCase()));
  return k ? r[k] : '';
};
export const num = (v: unknown) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
/** Turn a spreadsheet date (Excel serial, Date or text) into YYYY-MM-DD. */
export const isoDate = (v: unknown) => {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const d = v instanceof Date ? v : new Date(String(v ?? ''));
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};
