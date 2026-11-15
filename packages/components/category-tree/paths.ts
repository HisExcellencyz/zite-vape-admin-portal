// Category paths, shared by the browser and the endpoints (no React here, so endpoints can import it).
// A product's category is a path with " > " between levels, e.g. "Vapes > Disposables > Elf Bar".
// A plain name (no ">") is a top-level category, so categories saved before this change keep working.

export const SEP = ' > ';

/** "Vapes>Disposables > Elf Bar " -> "Vapes > Disposables > Elf Bar" (blank levels dropped). */
export const normalizePath = (p: string | null | undefined) =>
  String(p ?? '').split('>').map((s) => s.trim()).filter(Boolean).join(SEP);

export const pathParts = (p: string) => normalizePath(p).split(SEP).filter(Boolean);
/** The last level: "Vapes > Disposables" -> "Disposables" */
export const leafName = (p: string) => { const parts = pathParts(p); return parts[parts.length - 1] || ''; };
/** "Vapes > Disposables > Elf Bar" -> "Vapes > Disposables"; a top-level category has no parent (''). */
export const parentPath = (p: string) => pathParts(p).slice(0, -1).join(SEP);
/** Every level above: "A > B > C" -> ["A", "A > B"] */
export const ancestorPaths = (p: string) => { const parts = pathParts(p); return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join(SEP)); };

const lower = (s: string) => s.toLowerCase();

/** True when a product's category is the selected one or anything under it (case-insensitive). No selection matches everything. */
export function inCategory(productCategory: string | null | undefined, selected: string | null) {
  if (!selected) return true;
  const p = lower(normalizePath(productCategory)), s = lower(normalizePath(selected));
  return !!p && (p === s || p.startsWith(s + lower(SEP)));
}

/**
 * Tree from a list of category paths. Levels that are only implied by a deeper path (e.g. "Vapes" from
 * "Vapes > Pods") are added too. Names are kept as first seen; matching ignores capitals.
 */
export function buildPathTree(paths: (string | null | undefined)[]) {
  const all = new Map<string, string>(); // lower-case path -> display path
  for (const raw of paths) {
    const p = normalizePath(raw);
    if (!p) continue;
    for (const a of [...ancestorPaths(p), p]) if (!all.has(lower(a))) all.set(lower(a), a);
  }
  const list = [...all.values()].sort((a, b) => a.localeCompare(b));
  const kids = new Map<string, string[]>(); // parent path ('' = top) -> child paths
  for (const p of list) {
    const parent = all.get(lower(parentPath(p))) ?? '';
    kids.set(parent, [...(kids.get(parent) || []), p]);
  }
  const canonical = (p: string | null | undefined) => all.get(lower(normalizePath(p))) ?? null;
  /** Every path under this one, at any depth. */
  const descendantsOf = (p: string): string[] => {
    const out: string[] = []; const stack = [...(kids.get(p) || [])];
    while (stack.length) { const c = stack.pop()!; out.push(c); stack.push(...(kids.get(c) || [])); }
    return out;
  };
  /** Depth-first list for drop-downs, with indentation depth. */
  const flat: { path: string; depth: number }[] = [];
  const walk = (p: string, depth: number) => { flat.push({ path: p, depth }); (kids.get(p) || []).forEach((k) => walk(k, depth + 1)); };
  (kids.get('') || []).forEach((t) => walk(t, 0));
  return { tops: kids.get('') || [], kids, all: list, canonical, descendantsOf, flat };
}
