import { useCallback, useEffect, useState } from 'react';
import { getDirectory, saveProduct, importProducts, GetDirectoryOutputType } from 'zitejs/api';
import { useUpload } from 'zitejs/upload';
import { z } from 'zod';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Package, Link2, Loader2, X, Tags } from 'lucide-react';
import CategoriesDialog, { useCategories, Category } from '../components/CategoriesDialog';
import ExportMenu from '../components/ExportMenu';
import ImportButton from '../components/ImportButton';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import SimpleTable from '../components/SimpleTable';
import { money, exportRows, Fmt, pick, num } from '../lib/util';

type P = GetDirectoryOutputType['products'][0];
type Form = Omit<P, 'id'>;
const empty: Form = { sku: '', name: '', category: '', imageUrl: '', basePrice: 0, costPrice: 0, rrp: null, stock: 0, status: 'Available' };
const schema = z.object({
  sku: z.string().min(1, 'SKU required'), name: z.string().min(1, 'Name required'),
  costPrice: z.number().min(0, 'Must be ≥ 0'), basePrice: z.number().min(0, 'Must be ≥ 0'),
  rrp: z.number().min(0, 'Must be ≥ 0').nullable(), stock: z.number().int('Whole number').min(0, 'Must be ≥ 0'),
  imageUrl: z.string().refine((v) => !v || /^https?:\/\//i.test(v), 'Link must start with http(s)://'),
});
const ACCEPT = '.png,.jpg,.jpeg,image/png,image/jpeg';

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { upload, isUploading } = useUpload();
  const onFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(png|jpe?g)$/i.test(file.name)) return toast.error('Please choose a .png, .jpg or .jpeg file');
    try { onChange((await upload(file)).url); } catch { toast.error('Upload failed'); }
  };
  return (
    <div className="flex items-start gap-3 mt-1">
      <div className="relative h-16 w-16 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
        {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : value ? <img src={value} className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
        {value && !isUploading && <button type="button" onClick={() => onChange('')} className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5"><X className="h-3 w-3" /></button>}
      </div>
      <div className="flex-1 space-y-2">
        <Input type="file" accept={ACCEPT} disabled={isUploading} onChange={(e) => onFile(e.target.files?.[0])} />
        <div className="relative">
          <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="…or paste an image link (https://…)" value={value} onChange={(e) => onChange(e.target.value.trim())} />
        </div>
      </div>
    </div>
  );
}

function ProductDialog({ initial, onClose, onSaved, cats }: { initial: P | 'new' | null; onClose: () => void; onSaved: () => void; cats: Category[] }) {
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial) setF(initial === 'new' ? empty : initial); }, [initial]);
  const check = schema.safeParse(f);
  const errs: Record<string, string> = check.success ? {} : Object.fromEntries(check.error.issues.map((i) => [i.path[0], i.message]));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const err = (k: string) => errs[k] && <p className="text-xs text-destructive mt-1">{errs[k]}</p>;
  const margin = f.basePrice > 0 ? ((f.basePrice - f.costPrice) / f.basePrice) * 100 : 0;

  const submit = async () => {
    setBusy(true);
    try {
      await saveProduct({ id: initial !== 'new' ? initial?.id : undefined, data: { ...f, status: f.status as 'Available' | 'Discontinued' } });
      toast.success('Product saved'); onSaved(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!initial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial === 'new' ? 'Add product' : 'Edit product'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU</Label><Input value={f.sku} onChange={(e) => set('sku', e.target.value)} />{err('sku')}</div>
          <div><Label>Category</Label>
            <Select value={f.category || undefined} onValueChange={(v) => set('category', v === '__none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No category</SelectItem>
                {cats.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                {f.category && !cats.some((c) => c.name === f.category) && <SelectItem value={f.category}>{f.category}</SelectItem>}
              </SelectContent>
            </Select></div>
          <div className="col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => set('name', e.target.value)} />{err('name')}</div>
          <div><Label>Cost price (KES)</Label><Input type="number" min={0} value={f.costPrice} onChange={(e) => set('costPrice', Number(e.target.value))} />{err('costPrice')}</div>
          <div><Label>Selling price (KES)</Label><Input type="number" min={0} value={f.basePrice} onChange={(e) => set('basePrice', Number(e.target.value))} />{err('basePrice')}</div>
          <div><Label>RRP (KES)</Label><Input type="number" min={0} placeholder="Optional" value={f.rrp ?? ''} onChange={(e) => set('rrp', e.target.value === '' ? null : Number(e.target.value))} />{err('rrp')}</div>
          <div className="flex flex-col justify-end text-xs text-muted-foreground pb-2">Margin <span className={`text-sm font-semibold ${margin < 0 ? 'text-destructive' : 'text-foreground'}`}>{margin.toFixed(1)}%</span></div>
          <div><Label>Stock level</Label><Input type="number" min={0} value={f.stock} onChange={(e) => set('stock', Number(e.target.value))} />{err('stock')}</div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set('status', v)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Available">Available</SelectItem><SelectItem value="Discontinued">Discontinued</SelectItem></SelectContent></Select>
          </div>
          <div className="col-span-2"><Label>Image (.png, .jpg, .jpeg or link)</Label><ImageField value={f.imageUrl} onChange={(v) => set('imageUrl', v)} />{err('imageUrl')}</div>
          <p className="col-span-2 text-xs text-muted-foreground">Partners only see the selling price and RRP. Cost price stays internal.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!check.success || busy} onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const COLUMNS = ['SKU', 'Product Name', 'Category', 'Cost Price', 'Selling Price', 'RRP', 'Stock Level', 'Status', 'Image URL'];

export default function Products() {
  const [rows, setRows] = useState<P[] | null>(null);
  const [edit, setEdit] = useState<P | 'new' | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const cats = useCategories();
  const load = useCallback(() => getDirectory({}).then((d) => setRows(d.products)).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const doExport = (f: Fmt) => exportRows((rows ?? []).map((p) => ({ SKU: p.sku, 'Product Name': p.name, Category: p.category, 'Cost Price': p.costPrice, 'Selling Price': p.basePrice, RRP: p.rrp ?? '', 'Stock Level': p.stock, Status: p.status, 'Image URL': p.imageUrl })), 'Product Catalog', 'product-catalog', f);
  const doImport = async (data: Record<string, unknown>[]) => {
    const products = data.map((r) => {
      const rrp = pick(r, 'rrp');
      const cost = pick(r, 'cost price', 'cost');
      return {
        sku: String(pick(r, 'sku', 'product code')).trim(), name: String(pick(r, 'product name', 'name')),
        category: String(pick(r, 'category')), basePrice: num(pick(r, 'selling price', 'base price', 'price')),
        costPrice: cost === '' ? undefined : num(cost), rrp: rrp === '' ? undefined : num(rrp),
        stock: num(pick(r, 'stock level', 'stock')), status: String(pick(r, 'status') || 'Available'),
        imageUrl: String(pick(r, 'image url', 'image', 'image link')).trim() || undefined,
      };
    }).filter((p) => p.sku);
    if (!products.length) throw new Error('No rows with a SKU column were found');
    const res = await importProducts({ products });
    toast.success(`Imported ${res.count} products`);
    load(); cats.reload();
  };

  return (
    <div>
      <PageHeader title="Products">
          <ImportButton label="Import" templateName="product-catalog" onRows={doImport} columns={COLUMNS}
            hint="Existing products with the same SKU are updated. Image URL is optional."
            sampleRows={[
              { SKU: 'GS-001', 'Product Name': 'Example Device', Category: 'Devices', 'Cost Price': 1800, 'Selling Price': 2500, RRP: 3200, 'Stock Level': 100, Status: 'Available', 'Image URL': '' },
              { SKU: 'GS-002', 'Product Name': 'Example Refill Pack', Category: 'Accessories', 'Cost Price': 600, 'Selling Price': 950, RRP: 1200, 'Stock Level': 250, Status: 'Available', 'Image URL': '' },
            ]} />
          <ExportMenu label="Export" disabled={!rows?.length} onExport={doExport} />
          <Button onClick={() => setEdit('new')} className="bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]"><Plus className="h-4 w-4 mr-2" />Add product</Button>
      </PageHeader>
      <SimpleTable tools={<Button variant="outline" className="h-9 border-[hsl(var(--primary))] text-[hsl(var(--primary))]" onClick={() => setCatsOpen(true)}><Tags className="h-4 w-4 mr-2" />Categories</Button>} viewKey="products" image={(p) => p.imageUrl || null} rows={(rows ?? []).map((p) => ({ ...p, margin: p.basePrice > 0 ? ((p.basePrice - p.costPrice) / p.basePrice) * 100 : 0 }))} loading={!rows} searchKeys={['sku', 'name', 'category']} onEdit={({ margin: _m, ...r }) => setEdit(r)}
        onDelete={async (p) => { setRows((r) => r?.filter((x) => x.id !== p.id) ?? null); try { await saveProduct({ id: p.id, delete: true }); toast.success('Deleted'); } catch { toast.error('Delete failed'); load(); } }}
        cols={[
          { key: 'name', label: 'Name' },
          { key: 'sku', label: 'SKU', render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
          { key: 'category', label: 'Category' },
          { key: 'costPrice', label: 'Cost', render: (p) => money(p.costPrice) },
          { key: 'basePrice', label: 'Selling', render: (p) => money(p.basePrice) },
          { key: 'margin', label: 'Margin', render: (p) => `${p.margin.toFixed(1)}%` },
          { key: 'rrp', label: 'RRP', render: (p) => (p.rrp != null ? money(p.rrp) : '—') },
          { key: 'stock', label: 'Stock', render: (p) => <span className={p.stock <= 0 ? 'text-destructive font-medium' : ''}>{p.stock.toLocaleString()}</span> },
          { key: 'status', label: 'Status' },
        ]} />
      <ProductDialog initial={edit} cats={cats.list} onClose={() => setEdit(null)} onSaved={() => { load(); cats.reload(); }} />
      <CategoriesDialog open={catsOpen} onClose={() => setCatsOpen(false)} list={cats.list} setList={cats.setList} onChanged={load} />
    </div>
  );
}
