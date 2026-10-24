import { Button } from '@project/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import type { Fmt } from '../lib/util';

export default function ExportMenu({ label, disabled, onExport }: { label: string; disabled?: boolean; onExport: (f: Fmt) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={disabled} className="bg-secondary text-secondary-foreground hover:bg-secondary/85"><Download className="h-4 w-4 mr-2" />{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('csv')}>CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
