import { useEffect, useState } from 'react';
import { expenses as expensesApi, ExpensesOutputType } from 'zitejs/api';
import { z } from 'zod';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { DatePicker } from '@project/components/ui/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Exp = ExpensesOutputType['expenses'][0];
const CATS = ['Rent', 'Salaries', 'Transport', 'Utilities', 'Marketing', 'Other'];
const schema = z.object({ description: z.string().trim().min(1, 'Description required'), amount: z.number().positive('Amount must be more than 0') });

export default function ExpenseDialog({ initial, onClose, onSaved }: { initial: Exp | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ description: '', amount: 0, category: 'Other', notes: '' });
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!initial) return;
    if (initial === 'new') { setF({ description: '', amount: 0, category: 'Other', notes: '' }); setDate(new Date()); }
    else { setF(initial); setDate(initial.date ? new Date(initial.date) : new Date()); }
  }, [initial]);
  const check = schema.safeParse(f);
  const errs: Record<string, string> = check.success ? {} : Object.fromEntries(check.error.issues.map((i) => [i.path[0], i.message]));

  const submit = async () => {
    setBusy(true);
    try {
      const d = date!;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await expensesApi({ action: 'save', id: initial !== 'new' ? initial?.id : undefined, data: { ...f, date: iso } });
      toast.success('Expense saved'); onSaved(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!initial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial === 'new' ? 'Add expense' : 'Edit expense'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            {errs.description && f.description && <p className="text-xs text-destructive mt-1">{errs.description}</p>}</div>
          <div><Label>Amount (KES)</Label><Input type="number" min={0} value={f.amount || ''} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
            {errs.amount && f.amount !== 0 && <p className="text-xs text-destructive mt-1">{errs.amount}</p>}</div>
          <div><Label>Date</Label><DatePicker value={date} onChange={setDate} /></div>
          <div className="col-span-2"><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!check.success || !date || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
