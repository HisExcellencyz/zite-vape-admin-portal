import { DatePicker } from '../ui/date-picker';
import { Button } from '../ui/button';
import { X } from 'lucide-react';

export type Range = { from?: Date; to?: Date };

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** YYYY-MM-DD in local time, or undefined. */
export const toDay = (d?: Date) => (d ? day(d) : undefined);

/** True when the date falls on or between the start and end days (both inclusive). Undated rows only pass with no filter. */
export function inRange(value: string | null | undefined, r: Range) {
  if (!r.from && !r.to) return true;
  if (!value) return false;
  const v = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : day(new Date(value));
  return (!r.from || v >= day(r.from)) && (!r.to || v <= day(r.to));
}

/** Start/end date pickers. Results include both selected days. */
export default function DateRange({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-40"><DatePicker placeholder="Start date" value={value.from} onChange={(from) => onChange({ ...value, from })} /></div>
      <span className="text-xs text-muted-foreground">to</span>
      <div className="w-40"><DatePicker placeholder="End date" value={value.to} onChange={(to) => onChange({ ...value, to })} /></div>
      {(value.from || value.to) && (
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onChange({})} aria-label="Clear dates"><X className="h-4 w-4" /></Button>
      )}
    </div>
  );
}
