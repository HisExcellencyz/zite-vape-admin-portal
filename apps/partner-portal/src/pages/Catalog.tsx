import { useEffect, useMemo, useState } from 'react';
import { GetCatalogOutputType } from 'zitejs/api';
import { SearchInput, matchesQuery } from '@project/components/search';
import { loadCatalog } from '../lib/catalogCache';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Package, Plus, Check, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { useCart, money } from '../lib/cart';
import CategoryRibbon from '../components/CategoryRibbon';

type Product = GetCatalogOutputType['products'][0];

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">{message}</div>;
}

/**
 * Grid tile: square picture (the whole photo shows), name, price and the add button.
 * Every tile in a row is the same height and the button sits at the bottom, so all buttons line up.
 */
function ProductCard({ p, inCart, onAdd }: { p: Product; inCart: number; onAdd: () => void }) {
  return (
    <div className="tile bg-card border border-border rounded-xl p-2 flex flex-col h-full text-sm">
      <div className="aspect-square rounded-lg bg-white/90 dark:bg-muted overflow-hidden flex items-center justify-center">
        {p.imageUrl
          ? <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-contain" />
          : <Package className="h-12 w-12 text-muted-foreground/50" />}
      </div>
      <div className="mt-2 font-medium leading-snug line-clamp-2 min-h-[2.6em]" title={p.name}>{p.name}</div>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className="font-bold">{money(p.price)}</span>
        {p.rrp != null && <span className="text-xs text-muted-foreground">RRP {money(p.rrp)}</span>}
      </div>
      <Button
        className={`mt-auto w-full h-9 text-xs ${p.orderable ? 'bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]' : ''}`}
        size="sm"
        disabled={!p.orderable || inCart >= p.stock}
        onClick={onAdd}
        variant={p.orderable ? 'default' : 'secondary'}
      >
        {!p.orderable ? 'Out of stock' : inCart > 0 ? <><Check className="h-4 w-4 mr-1" />{inCart} in order · add 1</> : <><Plus className="h-4 w-4 mr-1" />Add to order</>}
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
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground/50" />}
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
  const [cat, setCat] = useState<string | null>(null);
  const { cart, setCart } = useCart();

  useEffect(() => {
    loadCatalog().then(setData).catch((e) => setError(e.message || 'Could not load catalog'));
  }, []);

  const categories = useMemo(() => [...new Set(data?.products.map((p) => p.category) ?? [])].sort(), [data]);
  const filtered = useMemo(() => {
    return (data?.products ?? []).filter(
      (p) => (!cat || p.category === cat) && matchesQuery([p.name, p.sku, p.category], q),
    );
  }, [data, q, cat]);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="page-header sticky top-[4.5rem] z-10 -mt-4 px-4 sm:px-5 py-3 rounded-2xl border mb-3 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-extrabold leading-tight text-gradient">{data ? `Welcome, ${data.companyName}` : 'Catalog'}</h1>
            <p className="text-xs text-muted-foreground">Browse the full product catalog.</p>
          </div>
          <div className="flex gap-2 flex-1">
            <SearchInput className="flex-1" placeholder="Search by name, SKU or category…" value={q} onChange={setQ} />
            <div className="flex rounded-md border border-border p-0.5 shrink-0">
              <Button size="icon" variant={view === 'grid' ? 'default' : 'ghost'} className="h-8 w-8" onClick={() => changeView('grid')} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></Button>
              <Button size="icon" variant={view === 'list' ? 'default' : 'ghost'} className="h-8 w-8" onClick={() => changeView('list')} aria-label="List view"><List className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
        <CategoryRibbon categories={categories} selected={cat} onSelect={setCat} />
      </div>
      {/* Tiles are 50% wider than before (up to 5 per row instead of 8) */}
      <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3' : 'space-y-2'}>
        {!data && Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className={view === 'grid' ? 'h-80 rounded-xl' : 'h-16 rounded-lg'} />)}
        {filtered.map((p) => (
          <ProductTile view={view} key={p.id} p={p} inCart={cart[p.id] ?? 0}
            onAdd={() => { setCart({ ...cart, [p.id]: (cart[p.id] ?? 0) + 1 }); toast.success(`${p.name} added to Quick Order`); }} />
        ))}
      </div>
      {data && filtered.length === 0 && <ErrorState message="No products match your search." />}
    </div>
  );
}
