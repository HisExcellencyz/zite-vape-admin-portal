import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const Cat = z.object({ id: z.string().nullable(), name: z.string(), description: z.string(), products: z.number() });

async function list() {
  const [{ records }, counts] = await Promise.all([
    zite.productCategories.findAll({ limit: 2000 }),
    zite.sql({ query: `SELECT "category" AS name, COUNT(*) AS n FROM "Products" WHERE COALESCE("category", '') <> '' GROUP BY "category"` }),
  ]);
  const n = new Map(counts.rows.map((r) => [String(r.name).toLowerCase(), Number(r.n) || 0]));
  const out: z.infer<typeof Cat>[] = records.filter((r) => r.name).map((r) => ({ id: r.id as string | null, name: r.name!, description: r.description ?? '', products: n.get(r.name!.toLowerCase()) ?? 0 }));
  const known = new Set(out.map((c) => c.name.toLowerCase()));
  // Categories typed on products before this list existed still show up
  for (const r of counts.rows) if (!known.has(String(r.name).toLowerCase())) out.push({ id: null, name: String(r.name), description: '', products: Number(r.n) || 0 });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function renameOnProducts(from: string, to: string) {
  const { rows } = await zite.sql({ query: `SELECT id FROM "Products" WHERE LOWER("category") = LOWER('${from.replace(/'/g, "''")}')` });
  const ids = rows.map((r) => String(r.id));
  for (let i = 0; i < ids.length; i += 20) await Promise.all(ids.slice(i, i + 20).map((id) => zite.products.update({ id, record: { category: to } })));
}

export default createEndpoint({
  description: 'Lists, creates, renames and deletes product categories',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    id: z.string().nullable().optional(),
    oldName: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  outputSchema: z.object({ categories: z.array(Cat) }),
  execute: async ({ input }) => {
    if (input.action === 'save') {
      const name = (input.name ?? '').trim();
      if (!name) throw new ZiteError('Category name is required', 'BAD_REQUEST');
      const clash = (await list()).find((c) => c.name.toLowerCase() === name.toLowerCase() && c.name !== input.oldName);
      if (clash) throw new ZiteError(`"${name}" already exists`, 'BAD_REQUEST');
      const record = { name, description: input.description ?? '' };
      if (input.id) await zite.productCategories.update({ id: input.id, record });
      else await zite.productCategories.create({ record });
      if (input.oldName && input.oldName !== name) await renameOnProducts(input.oldName, name);
    }
    if (input.action === 'delete') {
      if (input.id) await zite.productCategories.delete({ id: input.id });
      if (input.oldName) await renameOnProducts(input.oldName, '');
    }
    return { categories: await list() };
  },
});
