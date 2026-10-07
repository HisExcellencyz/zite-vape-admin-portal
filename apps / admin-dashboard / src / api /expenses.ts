import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const expense = z.object({ description: z.string(), amount: z.number(), date: z.string(), category: z.string(), notes: z.string() });
const CATS = ['Rent', 'Salaries', 'Transport', 'Utilities', 'Marketing', 'Other'];
const toRecord = (e: z.infer<typeof expense>) => ({
  description: e.description, amount: e.amount, expenseDate: e.date.slice(0, 10),
  category: CATS.includes(e.category) ? e.category : 'Other', notes: e.notes,
});

export default createEndpoint({
  description: 'Lists, creates, updates, deletes or bulk-imports other business expenses',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete', 'import']),
    id: z.string().optional(),
    data: expense.optional(),
    rows: z.array(expense).optional(),
  }),
  outputSchema: z.object({}),
  execute: async ({ input }) => {
    if (input.action === 'delete' && input.id) await zite.expenses.delete({ id: input.id });
    if (input.action === 'save' && input.data) {
      if (input.id) await zite.expenses.update({ id: input.id, record: toRecord(input.data) as never });
      else await zite.expenses.create({ record: toRecord(input.data) as never });
    }
    if (input.action === 'import' && input.rows) {
      const rows = input.rows.filter((r) => r.description.trim() && r.amount > 0);
      for (let i = 0; i < rows.length; i += 100)
        await zite.expenses.bulkCreate({ records: rows.slice(i, i + 100).map(toRecord) as never });
    }
    const { records } = await zite.expenses.findAll({ limit: 2000 });
    return {
      expenses: records.map((e) => ({
        id: e.id, description: e.description ?? '', amount: e.amount ?? 0, date: e.expenseDate ?? '',
        category: e.category ?? 'Other', notes: e.notes ?? '',
      })).sort((a, b) => b.date.localeCompare(a.date)),
    };
  },
});
