import { useEffect, useMemo, useState } from 'react';
import { getCatalog, GetCatalogOutputType } from 'zitejs/api';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Package, Search, Plus, Check, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { useCart, money } from '../lib/cart';

type Product = GetCatalogOutputType['products'][0];

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">{message}</div>;
}

function ProductCard({ p, inCart, onAdd }: { p: Product; inCart: number; onAdd: () => void }) {
  return (
    <div className="tile bg-card border border-border rounded-lg p-1.5 flex flex-col text-[0.75rem]">
      <div className="aspect-[16/15] rounded-md bg-muted overflow-hidden flex items-center justify-center">
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-10 w-10 text-muted-foreground/50" />}
      </div>
      <div className="text-[0.7rem] text-muted-foreground mt-1.5 font-mono">SKU {p.sku}</div>
      <div className="text-xs font-medium leading-snug line-clamp-2">{p.name}</div>
      <div className="flex justify-between items-end mt-1 text-xs">
        <span className="flex flex-col">
          <span className="font-semibold">{money(p.price)}</span>
          {p.rrp != null && <span className="text-[0.7rem] text-muted-foreground">RRP {money(p.rrp)}</span>}
        </span>
        <span className="text-xs text-muted-foreground">{p.orderable ? `${p.stock.toLocaleString()} in stock` : 'Out of stock'}</span>
      </div>
      <Button className={`mt-2 h-8 text-xs ${p.orderable ? 'bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]' : ''}`} size="sm" disabled={!p.orderable || inCart >= p.stock} onClick={onAdd} variant={p.orderable ? 'default' : 'secondary'}>
        {!p.orderable ? 'Unavailable' : inCart > 0 ? <><Check className="h-4 w-4 mr-1" />{inCart} in order · add 1</> : <><Plus className="h-4 w-4 mr-1" />Add to order</>}
      </Button>
    </div>
  );
}

function ProductTile({ view, ...rest }: { view: 'grid' | 'list'; p: Product; inCart: number; onAdd: () => void }) {
  return view === 'grid' ? <ProductCard {...rest} /> : <ProductRow {...rest} />;
}

function ProductRow({ p, inCart, onAdd }: { p: Product; inCart: number; onAdd: () => void }) {
  return (
    <div className="tile bg-card border border-border rounded-lg p-2 flex items-center gap-3 text-sm">
      <div className="h-12 w-12 shrink-0 rounded-md bg-muted overflow-hidden flex items-center justify-center">
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground/50" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{p.name}</div>
        <div className="text-xs text-muted-foreground font-mono">SKU {p.sku} · {p.category}</div>
      </div>
      <div className="text-right hidden sm:block">
        <div className="font-semibold">{money(p.price)}</div>
        {p.rrp != null && <div className="text-xs text-muted-foreground">RRP {money(p.rrp)}</div>}
      </div>
      <div className="text-xs text-muted-foreground w-24 text-right hidden md:block">{p.orderable ? `${p.stock.toLocaleString()} in stock` : 'Out of stock'}</div>
      <Button size="sm" className={`h-8 text-xs ${p.orderable ? 'bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]' : ''}`} disabled={!p.orderable || inCart >= p.stock} onClick={onAdd} variant={p.orderable ? 'default' : 'secondary'}>
        {!p.orderable ? 'Unavailable' : inCart > 0 ? <><Check className="h-4 w-4 mr-1" />{inCart}</> : <><Plus className="h-4 w-4 mr-1" />Add</>}
      </Button>
    </div>
  );
}

export default function Catalog() {
  const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('catalog-view') as 'grid' | 'list') || 'grid');
  const changeView = (v: 'grid' | 'list') => { setView(v); localStorage.setItem('catalog-view', v); };
  const [data, setData] = useState<GetCatalogOutputType | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const { cart, setCart } = useCart();

  useEffect(() => {
    getCatalog({}).then(setData).catch((e) => setError(e.message || 'Could not load catalog'));
  }, []);

  const categories = useMemo(() => [...new Set(data?.products.map((p) => p.category) ?? [])].sort(), [data]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (data?.products ?? []).filter(
      (p) => (cat === 'all' || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)),
    );
  }, [data, q, cat]);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="page-header sticky top-[4.5rem] z-10 -mt-4 px-4 sm:px-5 py-3 rounded-2xl border mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
        <div className="shrink-0">
        <h1 className="text-2xl font-extrabold leading-tight text-gradient">{data ? `Welcome, ${data.companyName}` : 'Catalog'}</h1>
        <p className="text-xs text-muted-foreground">Browse the full product catalog.</p>
        </div>
      <div className="flex flex-col sm:flex-row gap-2 flex-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border p-0.5 self-start">
          <Button size="icon" variant={view === 'grid' ? 'default' : 'ghost'} className="h-8 w-8" onClick={() => changeView('grid')} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></Button>
          <Button size="icon" variant={view === 'list' ? 'default' : 'ghost'} className="h-8 w-8" onClick={() => changeView('list')} aria-label="List view"><List className="h-4 w-4" /></Button>
        </div>
      </div>
      </div>
      </div>
      <div aria-hidden className="h-[18vh] sm:h-[26vh]" />
      <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5' : 'space-y-2'}>
        {!data && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={view === 'grid' ? 'h-60 rounded-lg' : 'h-16 rounded-lg'} />)}
        {filtered.map((p) => (
          <ProductTile view={view} key={p.id} p={p} inCart={cart[p.id] ?? 0}
            onAdd={() => { setCart({ ...cart, [p.id]: (cart[p.id] ?? 0) + 1 }); toast.success(`${p.name} added to Quick Order`); }} />
        ))}
      </div>
      {data && filtered.length === 0 && <ErrorState message="No products match your search." />}
    </div>
  );
}
