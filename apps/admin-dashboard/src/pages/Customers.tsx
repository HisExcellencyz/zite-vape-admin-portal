import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDirectory, saveCustomer, importCustomers, mergeCustomers, GetDirectoryOutputType } from 'zitejs/api';
import { z } from 'zod';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Badge } from '@project/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Plus, Merge, Loader2, Users } from 'lucide-react';
import { normText, phoneDigits } from '@project/components/search';
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
// The email is optional: a partner who later signs up on the Portal with another email can be merged into this company.
const schema = z.object({ company: z.string().min(1, 'Company name required'), email: z.union([z.literal(''), z.string().email('Valid email required')]) });

function CustomerDialog({ initial, onClose, onSaved }: { initial: C | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial) setF(initial === 'new' ? empty : { company: initial.company, email: initial.email, phone: initial.phone, address: initial.address, lat: initial.lat, lng: initial.lng, plusCode: initial.plusCode }); }, [initial]);
  const check = schema.safeParse({ ...f, email: f.email.trim() });
  const errs = check.success ? {} : Object.fromEntries(check.error.issues.map((i) => [i.path[0], i.message]));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try { await saveCustomer({ id: initial !== 'new' ? initial?.id : undefined, data: { ...f, email: f.email.trim() } }); toast.success('Customer saved'); onSaved(); onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!initial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial === 'new' ? 'Add customer' : 'Edit customer'}</DialogTitle>
          <DialogDescription>
            Anyone signing in to the Partner Portal with the contact email is linked to this company. If they sign up with a
            different email, merge the two records from the Customers page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Company name</Label><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />{errs.company && <p className="text-xs text-destructive mt-1">{errs.company}</p>}</div>
          <div><Label>Contact email <span className="text-muted-foreground font-normal">(optional)</span></Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />{errs.email && f.email && <p className="text-xs text-destructive mt-1">{errs.email}</p>}</div>
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

// ---------- Duplicates ----------

type Pair = { a: C; b: C; reason: string };
const phoneKey = (p?: string) => { const d = phoneDigits(p); return d.length >= 7 ? d : ''; };
/** Company name without punctuation and common endings, so "Acme Traders Ltd." and "ACME traders" match. */
const nameKey = (s?: string) => normText(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\b(and|ltd|limited|co|company|enterprises?|kenya)\b/g, ' ').replace(/\s+/g, '').trim();

/** Customers that look like the same business: same phone number (any format), same email, or same company name. */
function findDuplicates(rows: C[]): Pair[] {
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  const add = (a: C, b: C, reason: string) => {
    const k = [a.id, b.id].sort().join('|');
    if (seen.has(k)) return;
    seen.add(k);
    pairs.push({ a, b, reason });
  };
  const group = (key: (c: C) => string, reason: string) => {
    const m = new Map<string, C[]>();
    rows.forEach((c) => { const k = key(c); if (k) m.set(k, [...(m.get(k) || []), c]); });
    m.forEach((list) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) add(list[i], list[j], reason); });
  };
  group((c) => phoneKey(c.phone), 'same phone number');
  group((c) => c.email.trim().toLowerCase(), 'same email');
  group((c) => (nameKey(c.company).length >= 3 ? nameKey(c.company) : ''), 'same company name');
  return pairs;
}

type Use = { company: 'keep' | 'merge'; email: 'keep' | 'merge'; phone: 'keep' | 'merge'; address: 'keep' | 'merge' };
const DEFAULT_USE: Use = { company: 'keep', email: 'keep', phone: 'keep', address: 'keep' };

/** Pick two customer records, choose which details stay, and merge the second into the first. */
function MergeDialog({ open, rows, initial, onClose, onMerged }: {
  open: boolean; rows: C[]; initial: { keepId: string; mergeId: string } | null; onClose: () => void; onMerged: () => void;
}) {
  const [keepId, setKeepId] = useState('');
  const [mergeId, setMergeId] = useState('');
  const [use, setUse] = useState<Use>(DEFAULT_USE);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    // By default the record with a Portal sign-in or more orders is the one kept.
    if (initial) {
      const a = rows.find((r) => r.id === initial.keepId), b = rows.find((r) => r.id === initial.mergeId);
      const swap = a && b && (b.portalUsers > a.portalUsers || (b.portalUsers === a.portalUsers && b.orders > a.orders));
      setKeepId(swap ? initial.mergeId : initial.keepId); setMergeId(swap ? initial.keepId : initial.mergeId);
    } else { setKeepId(''); setMergeId(''); }
    setUse(DEFAULT_USE);
  }, [open, initial]);

  const keep = rows.find((r) => r.id === keepId);
  const other = rows.find((r) => r.id === mergeId);
  const sorted = useMemo(() => [...rows].sort((x, y) => x.company.localeCompare(y.company)), [rows]);
  const label = (c: C) => `${c.company || '(no name)'}${c.email ? ` · ${c.email}` : ''}${c.phone ? ` · ${c.phone}` : ''}`;

  const submit = async () => {
    if (!keep || !other || busy) return;
    setBusy(true);
    try {
      const r = await mergeCustomers({ keepId: keep.id, mergeId: other.id, use });
      toast.success(`Merged into ${keep.company}: ${r.movedOrders} order${r.movedOrders === 1 ? '' : 's'} moved, ${r.portalUsers} Portal sign-in${r.portalUsers === 1 ? '' : 's'} linked`);
      onMerged(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const Choice = ({ field, label: l, a, b }: { field: keyof Use; label: string; a: string; b: string }) => (
    <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 items-start text-sm">
      <span className="text-muted-foreground pt-1.5">{l}</span>
      {(['keep', 'merge'] as const).map((side) => {
        const v = side === 'keep' ? a : b;
        const on = use[field] === side;
        return (
          <button key={side} type="button" disabled={!v} onClick={() => setUse({ ...use, [field]: side })}
            className={`text-left rounded-md border px-2 py-1.5 break-words transition-colors ${on && v ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'} ${!v ? 'opacity-50 cursor-default' : ''}`}>
            {v || <span className="italic text-muted-foreground">blank</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge customers</DialogTitle>
          <DialogDescription>
            For a business added here that also registered itself on the Partner Portal. The second record's orders, balance and
            Portal sign-ins move to the first, so the partner keeps their access; then the second record is deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Keep this customer</Label>
              <Select value={keepId} onValueChange={setKeepId}><SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{sorted.filter((c) => c.id !== mergeId).map((c) => <SelectItem key={c.id} value={c.id}>{label(c)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>Merge this one into it</Label>
              <Select value={mergeId} onValueChange={setMergeId}><SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{sorted.filter((c) => c.id !== keepId).map((c) => <SelectItem key={c.id} value={c.id}>{label(c)}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          {keep && other && (
            <>
              <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 text-xs text-muted-foreground">
                <span />
                <span>Kept · {keep.orders} orders · {keep.portalUsers ? `${keep.portalUsers} Portal sign-in${keep.portalUsers === 1 ? '' : 's'}` : 'added by admin'}</span>
                <span>Merged in · {other.orders} orders · {other.portalUsers ? `${other.portalUsers} Portal sign-in${other.portalUsers === 1 ? '' : 's'}` : 'added by admin'}</span>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Tap the value to keep for each detail.</p>
              <Choice field="company" label="Company" a={keep.company} b={other.company} />
              <Choice field="email" label="Email" a={keep.email} b={other.email} />
              <Choice field="phone" label="Phone" a={keep.phone} b={other.phone} />
              <Choice field="address" label="Address" a={keep.address || (keep.lat != null ? 'Map pin only' : '')} b={other.address || (other.lat != null ? 'Map pin only' : '')} />
              <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                Balance after merging: {money((keep.balance || 0) + (other.balance || 0))}. Tier stays {keep.tier}. This can't be undone.
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!keep || !other || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Customers() {
  const [rows, setRows] = useState<C[] | null>(null);
  const [edit, setEdit] = useState<C | 'new' | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePair, setMergePair] = useState<{ keepId: string; mergeId: string } | null>(null);
  const [showDupes, setShowDupes] = useState(true);
  const load = useCallback(() => getDirectory({}).then((d) => setRows(d.customers)).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const dupes = useMemo(() => findDuplicates(rows ?? []), [rows]);
  const openMerge = (pair: { keepId: string; mergeId: string } | null) => { setMergePair(pair); setMergeOpen(true); };

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
          <Button variant="outline" disabled={(rows?.length ?? 0) < 2} onClick={() => openMerge(null)}><Merge className="h-4 w-4 mr-2" />Merge</Button>
          <Button onClick={() => setEdit('new')} className="bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]"><Plus className="h-4 w-4 mr-2" />Add customer</Button>
      </PageHeader>

      {dupes.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <button type="button" className="flex items-center gap-2 font-medium w-full text-left" onClick={() => setShowDupes((v) => !v)}>
            <Users className="h-4 w-4 text-amber-500" />
            {dupes.length} possible duplicate{dupes.length === 1 ? '' : 's'}: the same business added here and registered on the Portal?
            <span className="ml-auto text-xs text-muted-foreground">{showDupes ? 'Hide' : 'Show'}</span>
          </button>
          {showDupes && (
            <div className="mt-2 space-y-1.5">
              {dupes.map((p) => (
                <div key={`${p.a.id}|${p.b.id}`} className="flex flex-wrap items-center gap-2 rounded-md bg-background/60 px-2 py-1.5">
                  <span className="break-words">{p.a.company || '(no name)'}{p.a.portalUsers ? ' (Portal)' : ''}</span>
                  <span className="text-muted-foreground">and</span>
                  <span className="break-words">{p.b.company || '(no name)'}{p.b.portalUsers ? ' (Portal)' : ''}</span>
                  <Badge variant="secondary" className="text-[10px]">{p.reason}</Badge>
                  <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => openMerge({ keepId: p.a.id, mergeId: p.b.id })}>Review & merge</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SimpleTable viewKey="customers" rows={(rows ?? []) as C[]} loading={!rows} searchKeys={['company', 'email', 'phone'] as (keyof C)[]} onEdit={(r: C) => setEdit(r)}
        onDelete={async (c) => { setRows((r) => r?.filter((x) => x.id !== c.id) ?? null); try { await saveCustomer({ id: c.id, delete: true }); toast.success('Deleted'); } catch { toast.error('Delete failed'); load(); } }}
        cols={[
          { key: 'company', label: 'Company' }, { key: 'email', label: 'Contact email', render: (c) => c.email || '—' },
          { key: 'phone', label: 'Phone', render: (c) => c.phone || '—' },
          { key: 'portalUsers', label: 'Portal', render: (c) => (c.portalUsers ? <Badge variant="secondary" className="text-[10px]">Signed up</Badge> : <span className="text-muted-foreground text-xs">Added by admin</span>) },
          { key: 'orders', label: 'Orders' }, { key: 'revenue', label: 'Revenue', render: (c) => money(c.revenue) },
          { key: 'balance', label: 'Balance', render: (c) => money(c.balance) },
        ]} />
      <CustomerDialog initial={edit} onClose={() => setEdit(null)} onSaved={load} />
      <MergeDialog open={mergeOpen} rows={rows ?? []} initial={mergePair} onClose={() => setMergeOpen(false)} onMerged={load} />
    </div>
  );
}
