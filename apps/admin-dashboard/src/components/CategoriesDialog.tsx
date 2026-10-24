import { useEffect, useState } from 'react';
import { categories as categoriesApi, CategoriesOutputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export type Category = CategoriesOutputType['categories'][0];

export function useCategories() {
  const [list, setList] = useState<Category[]>([]);
  const reload = () => categoriesApi({ action: 'list' }).then((r) => setList(r.categories)).catch(() => {});
  useEffect(() => { reload(); }, []);
  return { list, setList, reload };
}

export default function CategoriesDialog({ open, onClose, list, setList, onChanged }: {
  open: boolean; onClose: () => void; list: Category[]; setList: (c: Category[]) => void; onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ old: Category; name: string } | null>(null);
  const [del, setDel] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (input: Parameters<typeof categoriesApi>[0], msg: string) => {
    setBusy(true);
    try { const r = await categoriesApi(input); setList(r.categories); toast.success(msg); onChanged(); return true; }
    catch (e) { toast.error((e as Error).message); return false; } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Create categories to group products. Renaming one updates every product in it.</DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: 'save', name }, 'Category added')) setName(''); }}>
          <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={!name.trim() || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
        </form>
        <div className="max-h-80 overflow-y-auto divide-y divide-border border border-border rounded-md">
          {list.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No categories yet.</p>}
          {list.map((c) => (
            <div key={c.name} className="flex items-center gap-2 px-3 py-2 text-sm">
              {editing?.old.name === c.name ? (
                <>
                  <Input className="h-8" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy || !editing.name.trim()}
                    onClick={async () => { if (await run({ action: 'save', id: c.id, oldName: c.name, name: editing.name }, 'Category renamed')) setEditing(null); }}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.products} products</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing({ old: c, name: c.name })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
        <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete “{del?.name}”?</AlertDialogTitle>
              <AlertDialogDescription>{del?.products ? `${del.products} products will be left without a category.` : 'No products use this category.'}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { run({ action: 'delete', id: del!.id, oldName: del!.name }, 'Category deleted'); setDel(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
