import { useCallback, useEffect, useMemo, useState } from 'react';
import { expenses as expensesApi, ExpensesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import DateRange, { Range, inRange } from '@project/components/date-range';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { money, exportRows, pick, num, isoDate } from '../lib/util';
import { Stat } from './Pipeline';
import SimpleTable from '../components/SimpleTable';
import ExportMenu from '../components/ExportMenu';
import ImportButton from '../components/ImportButton';
import ExpenseDialog from '../components/ExpenseDialog';
import PageHeader from '../components/PageHeader';
import HeaderTools from '../components/HeaderTools';

type Exp = ExpensesOutputType['expenses'][0];

export default function Expenses() {
  const [exp, setExp] = useState<Exp[] | null>(null);
  const [edit, setEdit] = useState<Exp | 'new' | null>(null);
  const [range, setRange] = useState<Range>({});
  const load = useCallback(() => expensesApi({ action: 'list' }).then((r) => setExp(r.expenses)).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const rows = useMemo(() => (exp ?? []).filter((e) => inRange(e.date, range)), [exp, range]);

  const doImport = async (data: Record<string, unknown>[]) => {
    const list = data.map((r) => ({
      description: String(pick(r, 'description', 'expense')), amount: num(pick(r, 'amount')),
      date: isoDate(pick(r, 'date', 'expense date')), category: String(pick(r, 'category') || 'Other'), notes: String(pick(r, 'notes')),
    })).filter((e) => e.description && e.amount > 0);
    if (!list.length) throw new Error('No rows with a Description and Amount were found');
    const r = await expensesApi({ action: 'import', rows: list });
    setExp(r.expenses);
    toast.success(`Imported ${list.length} expenses`);
  };

  return (
    <div>
      <PageHeader title="Expenses" stats={<Stat label={`Total · ${rows.length} expenses`} value={money(rows.reduce((s, e) => s + e.amount, 0))} />}>
        <ImportButton label="Import" templateName="expenses" onRows={doImport}
          columns={['Description', 'Amount', 'Date', 'Category', 'Notes']}
          hint="Category: Rent, Salaries, Transport, Utilities, Marketing or Other."
          sampleRows={[{ Description: 'October shop rent', Amount: 45000, Date: '2026-10-01', Category: 'Rent', Notes: '' }]} />
        <ExportMenu label="Export" disabled={!rows.length} onExport={(f) => exportRows(rows.map((e) => ({ Description: e.description, Amount: e.amount, Date: e.date, Category: e.category, Notes: e.notes })), 'Expenses', 'expenses', f)} />
        <Button onClick={() => setEdit('new')} className="bg-[hsl(var(--chart-3))] text-white hover:bg-[hsl(var(--chart-3)/0.85)]"><Plus className="h-4 w-4 mr-2" />Add expense</Button>
      </PageHeader>
      <HeaderTools><DateRange value={range} onChange={setRange} /></HeaderTools>
      <SimpleTable viewKey="expenses" rows={rows} loading={!exp} searchKeys={['description', 'category', 'notes']} onEdit={(e) => setEdit(e)}
        onDelete={async (e) => { setExp((x) => x?.filter((y) => y.id !== e.id) ?? null); try { await expensesApi({ action: 'delete', id: e.id }); toast.success('Deleted'); } catch { toast.error('Delete failed'); load(); } }}
        cols={[
          { key: 'description', label: 'Description' },
          { key: 'date', label: 'Date', render: (e) => (e.date ? new Date(e.date).toLocaleDateString() : '') },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount', render: (e) => money(e.amount) },
          { key: 'notes', label: 'Notes' },
        ]} />
      <ExpenseDialog initial={edit} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  );
}
