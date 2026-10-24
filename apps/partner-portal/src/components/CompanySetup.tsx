import { useState } from 'react';
import { registerCompany } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import LocationPicker, { LocationValue } from '@project/components/location-picker';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanySetup({ email, onDone }: { email: string; onDone: () => void }) {
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [loc, setLoc] = useState<LocationValue>({ lat: null, lng: null, plusCode: '' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try { await registerCompany({ company, address, ...loc }); toast.success('Welcome aboard!'); onDone(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center"><Building2 className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-semibold">Set up your company</h1>
          <p className="text-sm text-muted-foreground">Signed in as {email}</p></div>
      </div>
      <div><Label>Company name</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} />
        {!company.trim() && <p className="text-xs text-muted-foreground mt-1">Required</p>}</div>
      <div><Label>Shipping address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></div>
      <div><Label>Location pin <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <LocationPicker value={loc} onChange={setLoc} onAddress={(a) => setAddress((p) => p || a)} /></div>
      <Button className="w-full" disabled={!company.trim() || busy} onClick={submit}>
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Continue to catalog
      </Button>
    </div>
  );
}
