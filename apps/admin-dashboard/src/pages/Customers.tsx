import { useCallback, useEffect, useState } from 'react';
import { getDirectory, saveCustomer, importCustomers, GetDirectoryOutputType } from 'zitejs/api';
import { z } from 'zod';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus } from 'lucide-react';
import ExportMenu from '../components/ExportMenu';
import ImportButton from '../components/ImportButton';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import SimpleTable from '../components/SimpleTable';
import LocationPicker from '@project/components/location-picker';
import { money, exportRows, pick, num } from '../lib/util';

type C = GetDirectoryOutputType['customers'][0];
const CUST_COLS = ['Company Name', 'Contact Email', 'Phone', 'Shipping Address', 'Latitude', 'Longitude', 'Plus Code'];
const empty = { company: '', email: '', phone: '', address: '', lat: null as number | null, lng: null as number | null, plusCode: '' };
const schema = z.object({ company: z.string().min(1, 'Company name required'), email: z.string().email('Valid email required') });

function CustomerDialog({ initial, onClose, onSaved }: { initial: C | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial) setF(initial === 'new' ? empty : { company: initial.company, email: initial.email, phone: initial.phone, address: initial.address, lat: initial.lat, lng: initial.lng, plusCode: initial.plusCode }); }, [initial]);
  const check = schema.safeParse(f);
  const errs = check.success ? {} : Object.fromEntries(check.error.issues.map((i) => [i.path[0], i.message]));

  const submit = async () => {
    setBusy(true);
    try { await saveCustomer({ id: initial !== 'new' ? initial?.id : undefined, data: f }); toast.success('Customer saved'); onSaved(); onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!initial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial === 'new' ? 'Add customer' : 'Edit customer'}</DialogTitle>
          <DialogDescription>Anyone signing in to the Partner Portal with the contact email is linked to this company.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Company name</Label><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />{errs.company && <p className="text-xs text-destructive mt-1">{errs.company}</p>}</div>
          <div><Label>Contact email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />{errs.email && f.email && <p className="text-xs text-destructive mt-1">{errs.email}</p>}</div>
          <div><Label>Phone</Label><Input type="tel" placeholder="+254 7XX XXX XXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>Shipping address</Label><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <div><Label>Location pin</Label>
            <LocationPicker key={initial === 'new' ? 'new' : initial?.id} value={{ lat: f.lat, lng: f.lng, plusCode: f.plusCode }}
              onChange={(v) => setF((p) => ({ ...p, ...v }))} onAddress={(a) => setF((p) => (p.address ? p : { ...p, address: a }))} />
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!check.success || busy} onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Customers() {
  const [rows, setRows] = useState<C[] | null>(null);
  const [edit, setEdit] = useState<C | 'new' | null>(null);
  const load = useCallback(() => getDirectory({}).then((d) => setRows(d.customers)).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const doImport = async (data: Record<string, unknown>[]) => {
    const customers = data.map((r) => {
      const lat = pick(r, 'latitude', 'lat'), lng = pick(r, 'longitude', 'lng');
      return {
        company: String(pick(r, 'company name', 'company')), email: String(pick(r, 'contact email', 'email')), phone: String(pick(r, 'phone', 'customer phone', 'phone number')),
        address: String(pick(r, 'shipping address', 'address')),
        lat: lat === '' ? null : num(lat), lng: lng === '' ? null : num(lng), plusCode: String(pick(r, 'plus code')),
      };
    }).filter((c) => c.email && c.company);
    if (!customers.length) throw new Error('No rows with Company Name and Contact Email were found');
    const res = await importCustomers({ customers });
    toast.success(`Imported ${res.count} customers`);
    load();
  };

  return (
    <div>
      <PageHeader title="Customers">
          <ImportButton label="Import" templateName="customers" onRows={doImport} columns={CUST_COLS}
            hint="Existing customers with the same contact email are updated."
            sampleRows={[{ 'Company Name': 'Example Traders Ltd', 'Contact Email': 'buyer@example.co.ke', Phone: '+254712345678', 'Shipping Address': 'Moi Avenue, Nairobi', Latitude: -1.2841, Longitude: 36.8233, 'Plus Code': '6GCRQRM9+9V' }]} />
          <ExportMenu label="Export" disabled={!rows?.length} onExport={(fmt) => exportRows((rows ?? []).map((c) => ({ 'Company Name': c.company, 'Contact Email': c.email, Phone: c.phone, 'Shipping Address': c.address, Latitude: c.lat ?? '', Longitude: c.lng ?? '', 'Plus Code': c.plusCode, Orders: c.orders, Revenue: c.revenue, 'Total Balance': c.balance })), 'Customers', 'customers', fmt)} />
          <Button onClick={() => setEdit('new')} className="bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]"><Plus className="h-4 w-4 mr-2" />Add customer</Button>
      </PageHeader>
      <SimpleTable viewKey="customers" rows={(rows ?? []) as C[]} loading={!rows} searchKeys={['company', 'email', 'phone'] as (keyof C)[]} onEdit={(r: C) => setEdit(r)}
        onDelete={async (c) => { setRows((r) => r?.filter((x) => x.id !== c.id) ?? null); try { await saveCustomer({ id: c.id, delete: true }); toast.success('Deleted'); } catch { toast.error('Delete failed'); load(); } }}
        cols={[
          { key: 'company', label: 'Company' }, { key: 'email', label: 'Contact email' },
          { key: 'phone', label: 'Phone', render: (c) => c.phone || '—' },
          { key: 'orders', label: 'Orders' }, { key: 'revenue', label: 'Revenue', render: (c) => money(c.revenue) },
          { key: 'balance', label: 'Balance', render: (c) => money(c.balance) },
        ]} />
      <CustomerDialog initial={edit} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  );
}
