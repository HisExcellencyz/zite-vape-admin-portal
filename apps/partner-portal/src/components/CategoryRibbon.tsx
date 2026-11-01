import { useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';

const GAP = 8; // px, matches gap-2

/**
 * Category ribbon for the catalog, working like the one in the POS & Inventory app:
 * "All" followed by one chip per category. The chosen chip is highlighted (tap it again for All).
 * Chips that do not fit in one row move into a "More..." drop-down, and the chosen one always stays visible.
 */
export default function CategoryRibbon({ categories, selected, onSelect, className }: {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  className?: string;
}) {
  type Item = { key: string; label: string; active: boolean; onClick: () => void };
  const items: Item[] = [
    { key: '__all', label: 'All', active: !selected, onClick: () => onSelect(null) },
    ...categories.map((c) => ({ key: c, label: c, active: selected === c, onClick: () => onSelect(selected === c ? null : c) })),
  ];

  const wrapRef = useRef<HTMLDivElement>(null);
  const measRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(items.length);
  const signature = items.map((i) => `${i.key}:${i.active}`).join('|');

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

  if (categories.length === 0) return null;

  // Keep the chosen chip visible even if it would have landed in the drop-down.
  let visible = items.slice(0, count);
  let hidden = items.slice(count);
  const activeHidden = hidden.find((i) => i.active);
  if (activeHidden && visible.length > 0) {
    const swapped = visible[visible.length - 1];
    visible = [...visible.slice(0, -1), activeHidden];
    hidden = [swapped, ...hidden.filter((i) => i !== activeHidden)];
  }

  const chip = (i: Item, measuring = false) => (
    <button
      key={i.key}
      type="button"
      aria-pressed={i.active}
      tabIndex={measuring ? -1 : undefined}
      onClick={measuring ? undefined : i.onClick}
      className={cn(
        'inline-flex items-center gap-1 shrink-0 h-8 px-3 rounded-full border text-xs font-medium whitespace-nowrap transition-colors',
        i.active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {i.label}
      {i.active && i.key !== '__all' && <X className="w-3 h-3 opacity-80" aria-hidden />}
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
                  {i.active ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
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
