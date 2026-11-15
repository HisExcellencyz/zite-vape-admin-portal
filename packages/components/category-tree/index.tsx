import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { buildPathTree, ancestorPaths, leafName } from './paths';

export * from './paths';

// ---------- Ribbon ----------

type Item = { key: string; label: string; state: 'all' | 'active' | 'parent' | 'idle'; clearable?: boolean; onClick: () => void };
const GAP = 8; // px, matches gap-2

/**
 * Category ribbon (works like the one in the POS & Inventory app):
 * - "All" is always the first button.
 * - Nothing selected: All, then the top-level categories.
 * - A category selected: the other categories disappear. The ribbon shows All, the path down to the chosen
 *   category (tap a step to go back up to it), the chosen category, then the categories directly under it.
 *   Tap the chosen category again to go up one level.
 * - Chips that do not fit in one row move into a "More..." drop-down; the chosen one always stays visible.
 */
export default function CategoryRibbon({ categories, selected, onSelect, className }: {
  /** Every category path to offer (product categories and saved ones); levels in between are added automatically. */
  categories: (string | null | undefined)[];
  selected: string | null;
  onSelect: (path: string | null) => void;
  className?: string;
}) {
  const tree = useMemo(() => buildPathTree(categories), [categories]);
  const sel = tree.canonical(selected);

  const items: Item[] = useMemo(() => {
    const all: Item = { key: '__all', label: 'All', state: sel ? 'all' : 'active', onClick: () => onSelect(null) };
    if (!sel) return [all, ...tree.tops.map((p) => ({ key: p, label: leafName(p), state: 'idle' as const, onClick: () => onSelect(p) }))];
    const up = ancestorPaths(sel).map((a) => tree.canonical(a) || a);
    return [
      all,
      ...up.map((a) => ({ key: a, label: leafName(a), state: 'parent' as const, onClick: () => onSelect(a) })),
      { key: sel, label: leafName(sel), state: 'active' as const, clearable: true, onClick: () => onSelect(up.length ? up[up.length - 1] : null) },
      ...(tree.kids.get(sel) || []).map((p) => ({ key: p, label: leafName(p), state: 'idle' as const, onClick: () => onSelect(p) })),
    ];
  }, [sel, tree, onSelect]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const measRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(items.length);
  const signature = items.map((i) => `${i.key}:${i.state}`).join('|');

  useLayoutEffect(() => {
    const recalc = () => {
      const wrap = wrapRef.current, meas = measRef.current;
      if (!wrap || !meas) return;
      const widths = (Array.from(meas.children) as HTMLElement[]).map((el) => el.offsetWidth);
      const moreW = widths.pop() ?? 90; // the last measured child is the "More..." button
      const avail = wrap.clientWidth;
      const total = widths.reduce((a, w) => a + w, 0) + GAP * Math.max(0, widths.length - 1);
      if (total <= avail) { setCount(widths.length); return; }
      let used = 0, n = 0;
      for (let i = 0; i < widths.length; i++) {
        const need = widths[i] + (i > 0 ? GAP : 0);
        if (used + need + GAP + moreW <= avail) { used += need; n++; } else break;
      }
      setCount(Math.max(1, n));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [signature]);

  if (tree.tops.length === 0) return null;

  // Keep the chosen chip visible even if it would have landed in the drop-down.
  let visible = items.slice(0, count);
  let hidden = items.slice(count);
  const activeHidden = hidden.find((i) => i.state === 'active');
  if (activeHidden && visible.length > 0) {
    const swapped = visible[visible.length - 1];
    visible = [...visible.slice(0, -1), activeHidden];
    hidden = [swapped, ...hidden.filter((i) => i !== activeHidden)];
  }

  const chip = (i: Item, measuring = false) => (
    <button
      key={i.key}
      type="button"
      aria-pressed={i.state === 'active'}
      tabIndex={measuring ? -1 : undefined}
      onClick={measuring ? undefined : i.onClick}
      className={cn(
        'inline-flex items-center gap-1 shrink-0 h-8 px-3 rounded-full border text-xs font-medium whitespace-nowrap transition-colors',
        i.state === 'active' && 'bg-primary text-primary-foreground border-primary',
        i.state === 'parent' && 'border-primary/60 text-primary bg-primary/10',
        (i.state === 'idle' || i.state === 'all') && 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {i.label}
      {i.state === 'parent' && <ChevronRight className="w-3 h-3 opacity-70" aria-hidden />}
      {i.clearable && <X className="w-3 h-3 opacity-80" aria-hidden />}
    </button>
  );

  const moreBtn = (measuring = false) => (
    <button
      type="button"
      tabIndex={measuring ? -1 : undefined}
      className="inline-flex items-center gap-1 shrink-0 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground whitespace-nowrap"
    >
      More... <ChevronDown className="w-3 h-3" aria-hidden />
    </button>
  );

  return (
    <div ref={wrapRef} role="group" aria-label="Product categories" className={cn('relative w-full overflow-hidden', className)}>
      <div className="flex items-center gap-2">
        {visible.map((i) => chip(i))}
        {hidden.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>{moreBtn()}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              {hidden.map((i) => (
                <DropdownMenuItem key={i.key} onSelect={i.onClick} className="gap-2">
                  {i.state === 'active' ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
                  {i.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {/* Invisible copy of every chip, used only to measure how many fit in one row. */}
      <div ref={measRef} aria-hidden className="absolute left-0 top-0 flex w-max gap-2 invisible pointer-events-none">
        {items.map((i) => chip(i, true))}
        {moreBtn(true)}
      </div>
    </div>
  );
}
