import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { SEP, normalizePath, buildPathTree, parentPath, leafName, ancestorPaths } from '@project/components/category-tree/paths';

// Categories are a multi-level tree. Each category is saved as its full path with " > " between levels
// (e.g. "Vapes > Disposables > Elf Bar"), and a product's Category holds the same path. A plain name is a
// top-level category, so older data keeps working. Levels that only appear inside a longer path still show.

const Cat = z.object({
  id: z.string().nullable(),
  /** Full path, e.g. "Vapes > Disposables". */
  name: z.string(),
  /** The last level only, e.g. "Disposables". */
  label: z.string(),
  /** Path of the category it sits under ('' for a main category). */
  parent: z.string(),
  depth: z.number(),
  description: z.string(),
  /** Products in this category itself. */
  products: z.number(),
  /** Products in this category and every level under it. */
  total: z.number(),
  subcategories: z.number(),
});

const low = (s: string) => s.toLowerCase();
const under = (path: string, root: string) => low(path) === low(root) || low(path).startsWith(low(root + SEP));

async function load() {
  const [{ records }, prods] = await Promise.all([
    zite.productCategories.findAll({ limit: 2000 }),
    zite.sql({ query: `SELECT id, "category" FROM "Products" WHERE COALESCE("category", '') <> ''` }),
  ]);
  const products = prods.rows.map((r) => ({ id: String(r.id), category: normalizePath(String(r.category)) })).filter((p) => p.category);
  return { records, products };
}

async function list() {
  const { records, products } = await load();
  const tree = buildPathTree([...records.map((r) => r.name), ...products.map((p) => p.category)]);
  const recordOf = new Map(records.filter((r) => r.name).map((r) => [low(normalizePath(r.name)), r]));
  return tree.flat.map(({ path, depth }) => {
    const rec = recordOf.get(low(path));
    return {
      id: (rec?.id as string | undefined) ?? null,
      name: path,
      label: leafName(path),
      parent: parentPath(path),
      depth,
      description: rec?.description ?? '',
      products: products.filter((p) => low(p.category) === low(path)).length,
      total: products.filter((p) => under(p.category, path)).length,
      subcategories: (tree.kids.get(path) || []).length,
    };
  });
}

export default createEndpoint({
  description: 'Lists, creates, renames, moves and deletes product categories (a multi-level tree)',
  inputSchema: z.object({
    action: z.enum(['list', 'save', 'delete']),
    id: z.string().nullable().optional(),
    /** Full path of the category being renamed/moved/deleted. */
    oldName: z.string().optional(),
    /** The category's own name (one level). A name containing ">" is read as a full path. */
    name: z.string().optional(),
    /** Path of the category to put it under ('' or omitted = main category). */
    parent: z.string().optional(),
    description: z.string().optional(),
  }),
  outputSchema: z.object({ categories: z.array(Cat) }),
  execute: async ({ input }) => {
    if (input.action === 'save') {
      const own = normalizePath(input.name);
      if (!own) throw new ZiteError('Category name is required', 'BAD_REQUEST');
      const parent = normalizePath(input.parent);
      const path = normalizePath(parent && !own.includes(SEP) ? parent + SEP + own : own);
      const oldPath = normalizePath(input.oldName);

      if (oldPath && parent && under(parent, oldPath)) throw new ZiteError('A category cannot be moved under itself or one of its own subcategories', 'BAD_REQUEST');
      const existing = await list();
      const clash = existing.find((c) => low(c.name) === low(path) && low(c.name) !== low(oldPath));
      if (clash) throw new ZiteError(`"${path}" already exists`, 'BAD_REQUEST');

      const { records, products } = await load();
      const record = { name: path, description: input.description ?? '' };
      if (input.id) await zite.productCategories.update({ id: input.id, record });
      else await zite.productCategories.create({ record });

      // Renamed or moved: everything under the old path (saved categories and products) moves with it.
      if (oldPath && low(oldPath) !== low(path)) {
        const moved = (p: string) => path + p.slice(oldPath.length);
        const recs = records.filter((r) => r.id !== input.id && r.name && under(normalizePath(r.name), oldPath));
        for (let i = 0; i < recs.length; i += 20) {
          await Promise.all(recs.slice(i, i + 20).map((r) => zite.productCategories.update({ id: r.id, record: { name: moved(normalizePath(r.name)) } })));
        }
        const prods = products.filter((p) => under(p.category, oldPath));
        for (let i = 0; i < prods.length; i += 20) {
          await Promise.all(prods.slice(i, i + 20).map((p) => zite.products.update({ id: p.id, record: { category: moved(p.category) } })));
        }
      }
      // Make sure every level above exists as a saved category too, so it can be renamed later.
      const saved = new Set(records.map((r) => low(normalizePath(r.name))));
      saved.add(low(path));
      for (const a of ancestorPaths(path)) {
        if (!saved.has(low(a))) { await zite.productCategories.create({ record: { name: a, description: '' } }); saved.add(low(a)); }
      }
    }

    if (input.action === 'delete') {
      const oldPath = normalizePath(input.oldName);
      const current = (await list()).find((c) => low(c.name) === low(oldPath));
      if (current && current.subcategories > 0) {
        throw new ZiteError(`"${current.label}" has ${current.subcategories} subcategor${current.subcategories === 1 ? 'y' : 'ies'}. Move or delete them first.`, 'BAD_REQUEST');
      }
      if (input.id) await zite.productCategories.delete({ id: input.id });
      if (oldPath) {
        const { products } = await load();
        const prods = products.filter((p) => low(p.category) === low(oldPath));
        for (let i = 0; i < prods.length; i += 20) {
          await Promise.all(prods.slice(i, i + 20).map((p) => zite.products.update({ id: p.id, record: { category: '' } })));
        }
      }
    }

    return { categories: await list() };
  },
});
