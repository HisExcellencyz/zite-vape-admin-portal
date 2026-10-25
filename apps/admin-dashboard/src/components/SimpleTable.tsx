import { useMemo, useState, ReactNode } from 'react';
import { Input } from '@project/components/ui/input';
import HeaderTools from './HeaderTools';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { ArrowUpDown, Pencil, Trash2, LayoutGrid, List, Package } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';

export type Col<T> = { key: keyof T & string; label: string; render?: (row: T) => ReactNode };
const PAGE = 24;

export function ViewToggle({ view, onChange }: { view: 'list' | 'grid'; onChange: (v: 'list' | 'grid') => void }) {
  return (
    <div className="flex rounded-md border border-border p-0.5">
      <Button size="icon" variant={view === 'list' ? 'default' : 'ghost'} className="h-8 w-8" onClick={() => onChange('list')} aria-label="List view"><List className="h-4 w-4" /></Button>
      <Button size="icon" variant={view === 'grid' ? 'default' : 'ghost'} className="h-8 w-8" onClick={() => onChange('grid')} aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></Button>
    </div>
  );
}

export function useView(key: string) {
  const [view, setView] = useState<'list' | 'grid'>(() => (localStorage.getItem(`view-${key}`) as 'list' | 'grid') || 'list');
  return [view, (v: 'list' | 'grid') => { setView(v); localStorage.setItem(`view-${key}`, v); }] as const;
}

export default function SimpleTable<T extends { id: string }>({ rows, cols, loading, searchKeys, onEdit, onDelete, viewKey, image, onOpen, noViewToggle, tools }: {
  rows: T[]; cols: Col<T>[]; loading: boolean; searchKeys: (keyof T)[]; onEdit?: (r: T) => void; onDelete?: (r: T) => void;
  viewKey: string; image?: (r: T) => string | null; onOpen?: (r: T) => void; noViewToggle?: boolean; tools?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: keyof T; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [del, setDel] = useState<T | null>(null);
  const [storedView, setView] = useView(viewKey);
  const view = noViewToggle ? 'list' : storedView;

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    let r = rows.filter((x) => !s || searchKeys.some((k) => String(x[k] ?? '').toLowerCase().includes(s)));
    if (sort) r = [...r].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x == null || x === '') return 1; if (y == null || y === '') return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })) * sort.dir;
    });
    return r;
  }, [rows, q, sort, searchKeys]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const cell = (r: T, c: Col<T>) => (c.render ? c.render(r) : String(r[c.key] ?? ''));
  const actions = (r: T) => (
    <>
      {onEdit && <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(r); }}><Pencil className="h-4 w-4" /></Button>}
      {onDelete && <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDel(r); }}><Trash2 className="h-4 w-4" /></Button>}
    </>
  );

  return (
    <div>
      <HeaderTools>
        <div className="flex items-center gap-3 w-full">
          <Input className="max-w-sm h-9" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <div className="ml-auto flex items-center gap-2">
            {tools}
            <Select value={sort ? `${String(sort.key)}:${sort.dir}` : 'none'} onValueChange={(v) => { if (v === 'none') return setSort(null); const [k, d] = v.split(':'); setSort({ key: k as keyof T, dir: Number(d) as 1 | -1 }); }}>
              <SelectTrigger className="h-9 w-44"><ArrowUpDown className="h-3.5 w-3.5 mr-1 shrink-0" /><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default order</SelectItem>
                {cols.flatMap((c) => [
                  <SelectItem key={`${c.key}:1`} value={`${c.key}:1`}>{c.label} ↑</SelectItem>,
                  <SelectItem key={`${c.key}:-1`} value={`${c.key}:-1`}>{c.label} ↓</SelectItem>,
                ])}
              </SelectContent>
            </Select>
            {!noViewToggle && <ViewToggle view={view} onChange={setView} />}
          </div>
        </div>
      </HeaderTools>
      {view === 'list' ? (
        <div className="bg-card border border-border rounded-lg overflow-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className="text-left p-3 whitespace-nowrap">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort({ key: c.key, dir: sort?.key === c.key && sort.dir === 1 ? -1 : 1 })}>
                      {c.label}<ArrowUpDown className={`h-3 w-3 ${sort?.key === c.key ? 'text-primary' : ''}`} />
                    </button>
                  </th>
                ))}
                {(onEdit || onDelete) && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={cols.length + 1} className="p-3"><Skeleton className="h-6" /></td></tr>)}
              {slice.map((r) => (
                <tr key={r.id} onClick={() => onOpen?.(r)} className={`border-b border-border last:border-0 hover:bg-muted/50 ${onOpen ? 'cursor-pointer' : ''}`}>
                  {cols.map((c) => <td key={c.key} className="p-3">{cell(r, c)}</td>)}
                  {(onEdit || onDelete) && <td className="p-3 text-right whitespace-nowrap">{actions(r)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">Nothing found.</div>}
        </div>
      ) : (
        <div className={image ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'}>
          {loading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
          {slice.map((r) => (
            <div key={r.id} onClick={() => onOpen?.(r)} className={`tile bg-card border border-border rounded-lg flex flex-col ${image ? 'p-2 gap-1 text-xs' : 'p-3 gap-2 text-sm'} ${onOpen ? 'cursor-pointer' : ''}`}>
              {image && (
                <div className="aspect-[64/45] rounded-md bg-muted overflow-hidden flex items-center justify-center">
                  {image(r) ? <img src={image(r)!} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <Package className="h-8 w-8 text-muted-foreground/50" />}
                </div>
              )}
              <div className="font-medium">{cell(r, cols[0])}</div>
              <dl className={image ? "space-y-0.5" : "space-y-1"}>
                {cols.slice(1).map((c) => (
                  <div key={c.key} className="flex justify-between gap-2"><dt className="text-xs text-muted-foreground">{c.label}</dt><dd className="text-right truncate">{cell(r, c)}</dd></div>
                ))}
              </dl>
              {(onEdit || onDelete) && <div className="flex justify-end -mb-1 mt-auto">{actions(r)}</div>}
            </div>
          ))}
          {!loading && filtered.length === 0 && <div className="col-span-full p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">Nothing found.</div>}
        </div>
      )}
      <div className="flex justify-end items-center gap-2 mt-3 text-sm text-muted-foreground">
        <span>{filtered.length} records · Page {page + 1} of {pages}</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
        <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this record?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { onDelete?.(del!); setDel(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
