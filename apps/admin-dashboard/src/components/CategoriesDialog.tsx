import { useEffect, useRef, useState } from 'react';
import { categories as categoriesApi, CategoriesOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Check, CornerDownRight, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { SEP } from '@project/components/category-tree';

export type Category = CategoriesOutputType['categories'][0];

export function useCategories() {
  const [list, setList] = useState<Category[]>([]);
  const reload = () => categoriesApi({ action: 'list' }).then((r) => setList(r.categories)).catch(() => {});
  useEffect(() => { reload(); }, []);
  return { list, setList, reload };
}

const MAIN = '__main__';
const isUnder = (path: string, root: string) => path === root || path.toLowerCase().startsWith((root + SEP).toLowerCase());

/** A drop-down of every category (indented by level) to pick a parent; `exclude` and everything under it are left out. */
function ParentSelect({ list, value, onChange, exclude, className }: { list: Category[]; value: string; onChange: (v: string) => void; exclude?: string; className?: string }) {
  return (
    <Select value={value || MAIN} onValueChange={(v) => onChange(v === MAIN ? '' : v)}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={MAIN}>Main category (no parent)</SelectItem>
        {list.filter((c) => !exclude || !isUnder(c.name, exclude)).map((c) => (
          <SelectItem key={c.name} value={c.name}><span style={{ paddingLeft: c.depth * 12 }}>{c.label}</span></SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CategoriesDialog({ open, onClose, list, setList, onChanged }: {
  open: boolean; onClose: () => void; list: Category[]; setList: (c: Category[]) => void; onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [editing, setEditing] = useState<{ old: Category; name: string; parent: string } | null>(null);
  const [del, setDel] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const run = async (input: Parameters<typeof categoriesApi>[0], msg: string) => {
    if (busy) return false;
    setBusy(true);
    try { const r = await categoriesApi(input); setList(r.categories); toast.success(msg); onChanged(); return true; }
    catch (e) { toast.error((e as Error).message); return false; } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Group products in as many levels as you need, e.g. Vapes › Disposables › Elf Bar. Renaming or moving a category
            updates every product and subcategory under it.
          </DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_12rem_auto] gap-2"
          onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'save', name, parent }, parent ? 'Subcategory added' : 'Category added')) setName(''); }}>
          <Input ref={nameRef} placeholder={parent ? 'New subcategory name' : 'New category name'} value={name} onChange={(e) => setName(e.target.value)} />
          <ParentSelect list={list} value={parent} onChange={setParent} className="order-last col-span-2 sm:order-none sm:col-span-1" />
          <Button type="submit" disabled={!name.trim() || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
        </form>
        <div className="max-h-96 overflow-y-auto divide-y divide-border border border-border rounded-md">
          {list.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No categories yet.</p>}
          {list.map((c) => (
            <div key={c.name} className="flex items-center gap-2 px-3 py-2 text-sm" style={{ paddingLeft: 12 + c.depth * 18 }}>
              {editing?.old.name === c.name ? (
                <div className="flex-1 grid grid-cols-[1fr_auto_auto] gap-1.5 items-center">
                  <Input className="h-8" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy || !editing.name.trim()}
                    onClick={async () => { if (await run({ action: 'save', id: c.id, oldName: c.name, name: editing.name, parent: editing.parent }, 'Category updated')) setEditing(null); }}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                  <div className="col-span-3 flex items-center gap-2 text-xs text-muted-foreground">
                    Under <ParentSelect list={list} value={editing.parent} onChange={(v) => setEditing({ ...editing, parent: v })} exclude={c.name} className="h-8 flex-1" />
                  </div>
                </div>
              ) : (
                <>
                  {c.depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="flex-1 font-medium min-w-0 break-words">{c.label}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.total} product{c.total === 1 ? '' : 's'}{c.subcategories ? ` · ${c.subcategories} sub` : ''}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Add a subcategory under this one"
                    onClick={() => { setParent(c.name); setName(''); nameRef.current?.focus(); }}><Plus className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Rename or move" onClick={() => setEditing({ old: c, name: c.label, parent: c.parent })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
        <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete “{del?.label}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {del?.subcategories
                  ? `It has ${del.subcategories} subcategor${del.subcategories === 1 ? 'y' : 'ies'}: move or delete those first.`
                  : del?.products ? `${del.products} products will be left without a category.` : 'No products use this category.'}
              </AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={!!del?.subcategories} onClick={() => { run({ action: 'delete', id: del!.id, oldName: del!.name }, 'Category deleted'); setDel(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
