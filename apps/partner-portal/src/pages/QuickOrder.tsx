import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDraft, saveOrder, GetCatalogOutputType } from 'zitejs/api';
import { SearchInput, matchesQuery } from '@project/components/search';
import { loadCatalog, clearCatalog } from '../lib/catalogCache';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useCart, money, orderCode } from '../lib/cart';
import { ErrorState } from './Catalog';
import DocDownload from '@project/components/documents';

export default function QuickOrder() {
  const [data, setData] = useState<GetCatalogOutputType | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'submit'>('');
  const { cart, setCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([loadCatalog(), getDraft({})])
      .then(([cat, draft]) => {
        setData(cat);
        if (Object.keys(cart).length === 0 && Object.keys(draft.items).length) setCart(draft.items);
      })
      .catch((e) => setError(e.message || 'Could not load products'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return (data?.products ?? []).filter((p) => matchesQuery([p.name, p.sku, p.category], q));
  }, [data, q]);

  const priceMap = useMemo(() => new Map(data?.products.map((p) => [p.id, p]) ?? []), [data]);
  const lines = Object.entries(cart).filter(([id]) => priceMap.has(id));
  const units = lines.reduce((s, [, n]) => s + n, 0);
  const total = lines.reduce((s, [id, n]) => s + n * priceMap.get(id)!.price, 0);
  const overStock = lines.some(([id, n]) => { const p = priceMap.get(id)!; return !p.orderable || n > p.stock; });

  const setQty = (id: string, raw: string, max: number) => {
    const n = Math.max(0, Math.min(max, Math.floor(Number(raw) || 0)));
    setCart({ ...cart, [id]: n });
  };

  const save = async (submit: boolean) => {
    setBusy(submit ? 'submit' : 'draft');
    try {
      const res = await saveOrder({ submit, items: lines.map(([productId, quantity]) => ({ productId, quantity })) });
      if (submit) {
        clearCatalog();
        setCart({});
        toast.success(`Order ${orderCode(res.orderId ?? 0)} submitted`);
        navigate('/orders');
      } else toast.success('Draft saved');
    } catch (e) {
      toast.error((e as Error).message || 'Could not save order');
    } finally {
      setBusy('');
    }
  };

  if (error) return <ErrorState message={error} />;

  return (
    <div className="pb-28">
      <div className="page-header sticky top-[4.5rem] z-10 -mt-4 px-4 sm:px-5 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-gradient">Quick Order</h1>
          <p className="text-xs text-muted-foreground">Enter quantities down the list, then submit the whole order.</p>
        </div>
        <SearchInput className="sm:w-72" placeholder="Filter by name, SKU or category…" value={q} onChange={setQ} />
      </div>
      <div className="bg-card border border-border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
            <tr><th className="text-left p-3">SKU</th><th className="text-left p-3">Product</th><th className="text-right p-3">Selling price</th><th className="text-right p-3">RRP</th><th className="text-right p-3">Stock</th><th className="text-right p-3 w-32">Qty</th><th className="text-right p-3">Line total</th></tr>
          </thead>
          <tbody>
            {!data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={7} className="p-3"><Skeleton className="h-6" /></td></tr>)}
            {rows.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <tr key={p.id} className={`border-b border-border last:border-0 ${!p.orderable ? 'text-muted-foreground' : ''} ${qty ? 'bg-muted/60' : ''}`}>
                  <td className="p-3 font-mono text-xs">{p.sku}</td>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3 text-right">{money(p.price)}</td><td className="p-3 text-right text-muted-foreground">{p.rrp != null ? money(p.rrp) : '—'}</td>
                  <td className="p-3 text-right">{p.stock.toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {p.orderable ? (
                      <Input type="number" min={0} max={p.stock} value={qty || ''} placeholder="0"
                        onChange={(e) => setQty(p.id, e.target.value, p.stock)} className="h-8 w-24 ml-auto text-right" />
                    ) : <span className="text-xs">Out of stock</span>}
                  </td>
                  <td className="p-3 text-right">{qty ? money(qty * p.price) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-end gap-4">
          <span className="text-sm text-muted-foreground">{lines.length} items · {units.toLocaleString()} units</span>
          <span className="font-semibold text-lg">Total {money(total)}</span>
          <DocDownload variant="outline" disabled={units === 0} doc={() => ({
            kind: 'Quote', number: `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`, date: new Date(), customer: { name: data?.companyName ?? '' },
            lines: lines.filter(([, n]) => n > 0).map(([id, n]) => { const p = priceMap.get(id)!; return { sku: p.sku, name: p.name, quantity: n, unitPrice: p.price }; }),
          })} />
          <Button variant="outline" disabled={!!busy} onClick={() => save(false)}>
            {busy === 'draft' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save draft
          </Button>
          <Button disabled={!!busy || lines.length === 0 || overStock} onClick={() => save(true)}>
            {busy === 'submit' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit order
          </Button>
        </div>
      </div>
    </div>
  );
}
