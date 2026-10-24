import { useState } from 'react';
import { archiveToSheets } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ArchiveButton({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setOpen(false);
    setBusy(true);
    try {
      const r = await archiveToSheets({});
      toast.success(`Archived to Google Sheets: ${r.added} new, ${r.updated} updated rows`, {
        action: { label: 'Open', onClick: () => window.open(r.url, '_blank') },
      });
    } catch (e) {
      toast.error((e as Error).message || 'Archive failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" title="Archive to Google Sheets" className={collapsed ? 'md:w-10 md:h-10 md:mx-auto md:flex md:px-0' : 'md:w-full md:h-9 whitespace-nowrap'} disabled={busy} onClick={() => setOpen(true)}>
        {busy ? <Loader2 className="animate-spin" /> : <Archive />}<span className={collapsed ? 'md:hidden' : ''}>Archive to Sheets</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive all data to Google Sheets?</AlertDialogTitle>
            <AlertDialogDescription>
              Products, customers, orders, line items, payments and expenses are merged into the same tabs in your "Vapes Bulk Ordering" spreadsheet: existing rows are updated and new ones added. Nothing in the app is changed or deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Archive now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
