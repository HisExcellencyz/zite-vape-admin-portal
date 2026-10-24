import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import PptxGenJS from 'pptxgenjs';

export type RouteRow = { name: string; address: string; distance: string; duration: string };
export type RouteDoc = { start: string; end: string; summary: string; rows: RouteRow[]; url: string };

const stamp = () => new Date().toISOString().slice(0, 10);
const clean = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ').replace(/[^\x20-\x7E]/g, '');
const head = ['#', 'Stop', 'Address', 'Distance', 'Drive time'];
const body = (d: RouteDoc) => d.rows.map((r, i) => [String(i + 1), r.name, r.address, r.distance, r.duration]);

export function routeXlsx(d: RouteDoc) {
  const ws = XLSX.utils.aoa_to_sheet([['G-Shock Vapes · Route plan'], ['Date', new Date().toLocaleDateString()], ['Start', d.start], ['End', d.end],
    ['Summary', d.summary], ['Google Maps', d.url], [], head, ...body(d)]);
  ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 50 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Route'); XLSX.writeFile(wb, `route-plan-${stamp()}.xlsx`);
}

export async function routePdf(d: RouteDoc) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([842, 595]); let y = 545;
  const t = (s: string, x: number, size = 10, f = font, max = 80) => page.drawText(clean(s).slice(0, max), { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  t('Route plan', 40, 20, bold); y -= 22; t(`${new Date().toLocaleDateString()} · ${d.summary}`, 40); y -= 14;
  t(`Start: ${d.start}`, 40, 10, font, 120); y -= 14; t(`End: ${d.end}`, 40, 10, font, 120); y -= 26;
  const xs = [40, 70, 270, 680, 750];
  const header = () => { head.forEach((h, i) => t(h, xs[i], 9, bold)); y -= 6; page.drawLine({ start: { x: 40, y }, end: { x: 802, y }, thickness: 0.5 }); y -= 14; };
  header();
  for (const r of body(d)) {
    if (y < 40) { page = doc.addPage([842, 595]); y = 545; header(); }
    r.forEach((v, i) => t(v, xs[i], 9, font, i === 2 ? 75 : 34)); y -= 16;
  }
  const bytes = await doc.save();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
  a.download = `route-plan-${stamp()}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function routeSlides(d: RouteDoc) {
  const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE';
  const pink = 'E11D74';
  const s1 = pptx.addSlide();
  s1.addText('Route plan', { x: 0.6, y: 1.6, w: 12, h: 1, fontSize: 40, bold: true, color: pink, fontFace: 'Montserrat' });
  s1.addText(`${new Date().toLocaleDateString()}  ·  ${d.summary}`, { x: 0.6, y: 2.7, w: 12, h: 0.5, fontSize: 18, fontFace: 'Montserrat' });
  s1.addText(`Start: ${d.start}\nEnd: ${d.end}`, { x: 0.6, y: 3.4, w: 12, h: 1, fontSize: 14, color: '555555', fontFace: 'Montserrat' });
  s1.addText('Open in Google Maps', { x: 0.6, y: 4.6, w: 6, h: 0.4, fontSize: 14, color: pink, hyperlink: { url: d.url } });
  const rows = body(d);
  for (let i = 0; i < rows.length; i += 10) {
    const s = pptx.addSlide();
    s.addText(`Stops ${i + 1}–${Math.min(i + 10, rows.length)}`, { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, fontFace: 'Montserrat' });
    s.addTable([head.map((h) => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: pink } } })), ...rows.slice(i, i + 10).map((r) => r.map((text) => ({ text })))],
      { x: 0.5, y: 1.1, w: 12.3, colW: [0.6, 3.2, 5.9, 1.3, 1.3], fontSize: 12, fontFace: 'Montserrat', border: { type: 'solid', color: 'DDDDDD', pt: 0.5 } });
  }
  await pptx.writeFile({ fileName: `route-plan-${stamp()}.pptx` });
}
