import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { getDirectory, GetDirectoryOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Checkbox } from '@project/components/ui/checkbox';
import { Switch } from '@project/components/ui/switch';
import LocationPicker, { LocationValue } from '@project/components/location-picker';
import { Loader2, Navigation, ExternalLink, Flag, Download } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/PageHeader';
import HeaderTools from '../components/HeaderTools';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { routeXlsx, routePdf, routeSlides, RouteDoc } from '../lib/routeExport';

type C = GetDirectoryOutputType['customers'][0];
type Leg = { name: string; address: string; distance: string; duration: string };
const MAX_STOPS = 50;
const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
const hrs = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`);

export default function RoutePlan() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const overlays = useRef<{ setMap: (m: null) => void }[]>([]);
  const [ready, setReady] = useState(false);
  const [customers, setCustomers] = useState<C[] | null>(null);
  const [start, setStart] = useState<LocationValue>({ lat: null, lng: null, plusCode: '' });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [roundTrip, setRoundTrip] = useState(true);
  const [useEnd, setUseEnd] = useState(false);
  const [end, setEnd] = useState<LocationValue>({ lat: null, lng: null, plusCode: '' });
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ legs: Leg[]; distance: number; duration: number; url: string; loop: boolean; startLabel: string; endLabel: string } | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLEMAPS_API_KEY as string | undefined;

  useEffect(() => { getDirectory({}).then((d) => setCustomers(d.customers.filter((c) => c.lat != null || c.address.trim()))).catch((e) => toast.error(e.message)); }, []);
  useEffect(() => {
    if (!apiKey) return;
    new Loader({ apiKey, version: 'weekly' }).importLibrary('maps').then(async ({ Map }) => {
      await google.maps.importLibrary('geocoding');
      await google.maps.importLibrary('marker');
      if (!mapEl.current) return;
      map.current = new Map(mapEl.current, { center: { lat: -1.286, lng: 36.817 }, zoom: 11, mapTypeControl: false, streetViewControl: false });
      setReady(true);
    }).catch(() => toast.error('Failed to load Google Maps'));
  }, [apiKey]);

  const list = useMemo(() => (customers ?? []).filter((c) => !q || c.company.toLowerCase().includes(q.toLowerCase())), [customers, q]);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else if (n.size < MAX_STOPS) n.add(id); else toast.error(`Up to ${MAX_STOPS} stops per route`); return n; });
  const allOn = list.length > 0 && list.every((c) => picked.has(c.id));

  const planRoute = async () => {
    if (start.lat == null || start.lng == null || !map.current) return;
    const origin = { lat: start.lat, lng: start.lng };
    const stops = (customers ?? []).filter((c) => picked.has(c.id));
    setBusy(true); setPlan(null);
    try {
      // Resolve every stop to coordinates (pins first, otherwise geocode the address)
      const geocoder = new google.maps.Geocoder();
      const pts = await Promise.all(stops.map(async (c) => {
        if (c.lat != null && c.lng != null) return { lat: c.lat, lng: c.lng };
        const r = await geocoder.geocode({ address: c.address }).catch(() => null);
        const loc = r?.results[0]?.geometry.location;
        if (!loc) throw new Error(`Could not find the address for ${c.company}`);
        return { lat: loc.lat(), lng: loc.lng() };
      }));
      const endPt = useEnd && end.lat != null && end.lng != null ? { lat: end.lat, lng: end.lng } : null;
      const loop = !endPt && roundTrip;
      const all = endPt ? [origin, ...pts, endPt] : [origin, ...pts];
      const coords = all.map((p) => `${p.lng},${p.lat}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=${loop}${loop ? '' : endPt ? '&destination=last' : '&destination=any'}&geometries=geojson&overview=full`);
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error('Could not plan this route');
      // waypoints[i].waypoint_index = position of input i in the optimised trip
      const seq: number[] = []; j.waypoints.forEach((w: { waypoint_index: number }, i: number) => { seq[w.waypoint_index] = i; });
      const visit = seq.slice(1).filter((i) => i <= stops.length).map((i) => ({ c: stops[i - 1], p: all[i] }));
      const tripLegs = j.trips[0].legs as { distance: number; duration: number }[];
      const legs: Leg[] = tripLegs.map((l, i) => ({
        name: visit[i]?.c.company ?? (endPt ? 'End location' : 'Back to start'), address: visit[i] ? (visit[i].c.address || 'Map pin') : endPt ? 'End location' : 'Start location',
        distance: km(l.distance), duration: hrs(l.duration),
      }));
      overlays.current.forEach((o) => o.setMap(null));
      const path = (j.trips[0].geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng }));
      const line = new google.maps.Polyline({ map: map.current, path, strokeColor: '#e11d74', strokeWeight: 5, strokeOpacity: 0.85 });
      const markers = [new google.maps.Marker({ map: map.current, position: origin, label: 'S' }),
        ...visit.map((v, i) => new google.maps.Marker({ map: map.current, position: v.p, label: String(i + 1), title: v.c.company })),
        ...(endPt ? [new google.maps.Marker({ map: map.current, position: endPt, label: 'E' })] : [])];
      overlays.current = [line, ...markers];
      const bounds = new google.maps.LatLngBounds(); path.forEach((p) => bounds.extend(p)); map.current.fitBounds(bounds);
      const dest = endPt ?? (loop ? origin : visit[visit.length - 1].p);
      const via = endPt || loop ? visit : visit.slice(0, -1);
      const url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&waypoints=${encodeURIComponent(via.map((v) => `${v.p.lat},${v.p.lng}`).join('|'))}`;
      const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
      setPlan({ legs, url, loop, startLabel: fmt(origin), endLabel: endPt ? fmt(endPt) : loop ? 'Back to start' : visit[visit.length - 1].c.company, distance: j.trips[0].distance, duration: j.trips[0].duration });
    } catch (e) { toast.error((e as Error).message || 'Could not plan this route'); }
    finally { setBusy(false); }
  };

  const routeDoc = (): RouteDoc => ({ start: plan!.startLabel, end: plan!.endLabel, url: plan!.url,
    summary: `${plan!.legs.length} legs · ${km(plan!.distance)} · about ${hrs(plan!.duration)}`, rows: plan!.legs });

  return (
    <div>
      <PageHeader title="Route plan" subtitle="Pick a start point and customers; the stops are ordered for the shortest drive." />
      <HeaderTools>
        <Button disabled={!ready || busy || start.lat == null || picked.size === 0 || (useEnd && end.lat == null)} onClick={planRoute}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}Plan best route
        </Button>
        {plan && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><Download className="h-4 w-4 mr-2" />Download route</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => routeXlsx(routeDoc())}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => routeSlides(routeDoc()).catch(() => toast.error('Could not create slides'))}>Slides (.pptx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => routePdf(routeDoc()).catch(() => toast.error('Could not create PDF'))}>PDF (.pdf)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </HeaderTools>
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-3">
            <Label className="mb-2 block">Start location</Label>
            <LocationPicker value={start} onChange={setStart} />
            <label className="flex items-center justify-between mt-3 text-sm">Set a different end location<Switch checked={useEnd} onCheckedChange={setUseEnd} /></label>
            {useEnd ? (
              <div className="mt-3"><Label className="mb-2 block">End location</Label><LocationPicker value={end} onChange={setEnd} /></div>
            ) : (
              <label className="flex items-center justify-between mt-3 text-sm">Return to start<Switch checked={roundTrip} onCheckedChange={setRoundTrip} /></label>
            )}
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2"><Label>Customers ({picked.size}/{MAX_STOPS})</Label>
              <button className="text-xs text-primary" onClick={() => setPicked(allOn ? new Set() : new Set(list.slice(0, MAX_STOPS).map((c) => c.id)))}>{allOn ? 'Clear' : 'Select all'}</button></div>
            <Input className="mb-2" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-72 overflow-y-auto space-y-1">
              {!customers && <Loader2 className="h-4 w-4 animate-spin mx-auto my-4 text-muted-foreground" />}
              {customers?.length === 0 && <p className="text-sm text-muted-foreground p-2">No customers have an address or pin yet.</p>}
              {list.map((c) => (
                <label key={c.id} className="flex gap-2 items-start p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox className="mt-0.5" checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span><span className="font-medium">{c.company}</span><span className="block text-xs text-muted-foreground line-clamp-1">{c.lat != null ? 'Map pin' : c.address}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="relative h-[calc(100vh-10rem)] min-h-[420px] rounded-lg overflow-hidden border border-border">
            <div ref={mapEl} className="w-full h-full" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">{apiKey ? 'Loading map…' : 'Google Maps is not connected.'}</div>}
          </div>
          {plan && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="font-medium">{plan.legs.length} legs · {km(plan.distance)} · about {hrs(plan.duration)}</div>
                <Button size="sm" variant="outline" asChild><a href={plan.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Open in Google Maps</a></Button>
              </div>
              <ol className="space-y-2">
                {plan.legs.map((l, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{i === plan.legs.length - 1 && (plan.loop || plan.endLabel.includes(',')) ? <Flag className="h-3 w-3" /> : i + 1}</span>
                    <span className="flex-1"><span className="font-medium">{l.name}</span><span className="block text-xs text-muted-foreground">{l.address}</span></span>
                    <span className="text-xs text-muted-foreground text-right whitespace-nowrap">{l.distance}<br />{l.duration}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
