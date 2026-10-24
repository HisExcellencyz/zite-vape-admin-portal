import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Download } from 'lucide-react';

export const SELLER = 'G-Shock Vapes';
export type DocFormat = 'pdf' | 'xlsx' | 'docx';
export type SalesDoc = {
  kind: 'Invoice' | 'Quote';
  number: string;
  date: Date;
  customer: { name: string; email?: string; phone?: string; address?: string };
  lines: { sku: string; name: string; quantity: number; unitPrice: number }[];
  paid?: number;
};

const kes = (n: number) => `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clean = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[^\x20-\x7E\n]/g, '');
const totals = (d: SalesDoc) => {
  const total = d.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const rows: [string, string][] = [['Total', kes(total)]];
  if (d.kind === 'Invoice') rows.push(['Paid', kes(d.paid ?? 0)], ['Balance due', kes(total - (d.paid ?? 0))]);
  return rows;
};
const fileName = (d: SalesDoc, ext: string) => `${d.kind.toLowerCase()}-${d.number}.${ext}`;
function save(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function pdf(d: SalesDoc) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]); let y = 790;
  const text = (s: string, x: number, size = 10, f = font, right = false) => {
    const t = clean(s); page.drawText(t, { x: right ? x - f.widthOfTextAtSize(t, size) : x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  };
  text(SELLER, 50, 11, bold); text(d.kind.toUpperCase(), 545, 22, bold, true); y -= 24;
  text(`${d.kind} no. ${d.number}`, 545, 10, font, true); y -= 14; text(d.date.toLocaleDateString(), 545, 10, font, true); y -= 30;
  text('Bill to', 50, 9, bold); y -= 14;
  for (const s of [d.customer.name, ...(d.customer.address ?? '').split('\n'), d.customer.email ?? '', d.customer.phone ?? ''].filter(Boolean)) { text(s, 50); y -= 13; }
  y -= 16;
  const cols = [50, 130, 380, 460, 545];
  const header = () => { ['SKU', 'Product'].forEach((h, i) => text(h, cols[i], 9, bold)); ['Qty', 'Unit', 'Total'].forEach((h, i) => text(h, cols[i + 2] + (i ? 0 : 30), 9, bold, true)); y -= 6; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5 }); y -= 14; };
  header();
  for (const l of d.lines) {
    if (y < 120) { page = doc.addPage([595, 842]); y = 790; header(); }
    text(l.sku, cols[0], 9); text(l.name.slice(0, 48), cols[1], 9);
    text(String(l.quantity), cols[2] + 30, 9, font, true); text(kes(l.unitPrice), cols[3], 9, font, true); text(kes(l.quantity * l.unitPrice), cols[4], 9, font, true);
    y -= 16;
  }
  y -= 8; page.drawLine({ start: { x: 330, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 0.5 });
  for (const [k, v] of totals(d)) { text(k, 340, 10, bold); text(v, 545, 10, bold, true); y -= 16; }
  if (d.kind === 'Quote') { y -= 20; text('Prices are subject to stock availability at the time of ordering.', 50, 8); }
  save(new Blob([(await doc.save()) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), fileName(d, 'pdf'));
}

function xlsx(d: SalesDoc) {
  const aoa: (string | number)[][] = [[SELLER], [`${d.kind} ${d.number}`], ['Date', d.date.toLocaleDateString()], ['Customer', d.customer.name],
    ['Email', d.customer.email ?? ''], ['Address', d.customer.address ?? ''], [], ['SKU', 'Product', 'Quantity', 'Unit Price (KES)', 'Line Total (KES)'],
    ...d.lines.map((l) => [l.sku, l.name, l.quantity, l.unitPrice, l.quantity * l.unitPrice]), [], ...totals(d).map(([k, v]) => ['', '', '', k, v])];
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 18 }, { wch: 20 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, d.kind); XLSX.writeFile(wb, fileName(d, 'xlsx'));
}

async function docx(d: SalesDoc) {
  const cell = (t: string, b = false, right = false) => new TableCell({ children: [new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: t, bold: b })] })] });
  const table = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ tableHeader: true, children: ['SKU', 'Product', 'Qty', 'Unit', 'Total'].map((h, i) => cell(h, true, i > 1)) }),
    ...d.lines.map((l) => new TableRow({ children: [cell(l.sku), cell(l.name), cell(String(l.quantity), false, true), cell(kes(l.unitPrice), false, true), cell(kes(l.quantity * l.unitPrice), false, true)] })),
  ] });
  const p = (t: string, bold = false) => new Paragraph({ children: [new TextRun({ text: t, bold })] });
  const doc = new Document({ styles: { default: { document: { run: { font: 'Montserrat', size: 20 } } } }, sections: [{ children: [
    p(SELLER, true), new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${d.kind} ${d.number}`)] }), p(d.date.toLocaleDateString()), p(''),
    p('Bill to', true), p(d.customer.name), ...(d.customer.address ?? '').split('\n').filter(Boolean).map((s) => p(s)),
    ...[d.customer.email, d.customer.phone].filter(Boolean).map((s) => p(s!)), p(''), table, p(''),
    ...totals(d).map(([k, v]) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun(v)] })),
  ] }] });
  save(await Packer.toBlob(doc), fileName(d, 'docx'));
}

export async function downloadDoc(d: SalesDoc, fmt: DocFormat) {
  if (fmt === 'pdf') return pdf(d);
  if (fmt === 'xlsx') return xlsx(d);
  return docx(d);
}

/** "Download invoice/quote" button with PDF, Excel and Word options. */
export default function DocDownload({ doc, disabled, className, variant = 'default' }: { doc: () => SalesDoc; disabled?: boolean; className?: string; variant?: 'default' | 'outline' }) {
  const run = (f: DocFormat) => downloadDoc(doc(), f).catch(() => alert('Could not create the file'));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} disabled={disabled} className={className}><Download className="h-4 w-4 mr-2" />Download {doc().kind.toLowerCase()}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run('pdf')}>PDF (.pdf)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('docx')}>Word (.docx)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
