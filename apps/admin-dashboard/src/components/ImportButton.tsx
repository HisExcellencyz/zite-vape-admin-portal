import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@project/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  label: string;
  templateName: string;
  columns: string[];
  sampleRows: Record<string, unknown>[];
  onRows: (rows: Record<string, unknown>[]) => Promise<void>;
  hint?: string;
};

export default function ImportButton({ label, templateName, columns, sampleRows, onRows, hint }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // One Excel template per import; the same columns can also be saved and uploaded as .csv.
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: columns });
    ws['!cols'] = columns.map((c) => ({ wch: Math.max(14, c.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${templateName}-template.xlsx`);
  };

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const name = file.name.toLowerCase();
      const isCsv = name.endsWith('.csv') || name.endsWith('.txt');
      if (!isCsv && !name.endsWith('.xlsx') && !name.endsWith('.xls')) throw new Error('Choose an Excel (.xlsx) or CSV (.csv) file');
      // CSV is read as plain text (UTF-8, values kept as typed) so phone numbers keep their leading 0 or +.
      const wb = isCsv ? XLSX.read((await file.text()).replace(/^\uFEFF/, ''), { type: 'string', raw: true }) : XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) throw new Error('The file has no rows');
      await onRows(rows);
      setOpen(false);
    } catch (e) { toast.error((e as Error).message || 'Import failed'); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-[hsl(var(--chart-4))] text-white hover:bg-[hsl(var(--chart-4)/0.85)]"><Upload className="h-4 w-4 mr-2" />{label}</Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>Upload an Excel (.xlsx) or CSV (.csv) file. Both work with the same template. {hint}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted p-4">
            <div className="text-sm font-medium mb-1">1. Download the template</div>
            <div className="text-xs text-muted-foreground mb-3">Columns: {columns.join(', ')}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadTemplate}><FileSpreadsheet className="h-4 w-4 mr-2" />Download template (.xlsx)</Button>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-border p-4">
            <div className="text-sm font-medium mb-1">2. Upload your filled-in file</div>
            <div className="text-xs text-muted-foreground mb-3">Excel (.xlsx) or CSV (.csv), with the template's column names in the first row.</div>
            <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
            <Button disabled={busy} onClick={() => ref.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Choose file
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
