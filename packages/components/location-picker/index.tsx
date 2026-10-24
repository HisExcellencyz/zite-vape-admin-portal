import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, MapPin, Search, X } from 'lucide-react';

export type LocationValue = { lat: number | null; lng: number | null; plusCode: string };
type Mode = 'search' | 'coords' | 'plus';

type Suggestion = { label: string; sub?: string; req: google.maps.GeocoderRequest };
const TOWNS = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika'];
const pcOf = (r: google.maps.GeocoderResult) => (r as unknown as { plus_code?: { global_code?: string } }).plus_code?.global_code;

const HINTS: Record<Mode, string> = {
  search: 'Search a place or address, e.g. Westlands, Nairobi',
  coords: 'Latitude, longitude, e.g. -1.2864, 36.8172',
  plus: 'Plus code, e.g. 6GCRPR6C+24 or PR6C+24 Nairobi',
};

/** Pick a location pin by search, coordinates or plus code. Click or drag on the map to fine-tune. */
export default function LocationPicker({ value, onChange, onAddress }: {
  value: LocationValue; onChange: (v: LocationValue) => void; onAddress?: (address: string) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const cb = useRef(onChange); cb.current = onChange;
  const [mode, setMode] = useState<Mode>('search');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const places = useRef(false);
  const placesOk = useRef(true);
  const seq = useRef(0);
  const apiKey = import.meta.env.VITE_GOOGLEMAPS_API_KEY as string | undefined;

  const plusFor = async (lat: number, lng: number) => {
    try {
      const { results } = await geocoder.current!.geocode({ location: { lat, lng } });
      const pc = (results[0] as unknown as { plus_code?: { global_code?: string } })?.plus_code?.global_code;
      return pc ?? '';
    } catch { return ''; }
  };

  const place = async (lat: number, lng: number, plusCode?: string) => {
    const pos = { lat, lng };
    marker.current?.setPosition(pos); marker.current?.setVisible(true);
    map.current?.panTo(pos); if ((map.current?.getZoom() ?? 0) < 14) map.current?.setZoom(15);
    cb.current({ lat, lng, plusCode: plusCode ?? (await plusFor(lat, lng)) });
  };

  useEffect(() => {
    if (!apiKey) { setErr('Google Maps is not connected.'); return; }
    let alive = true;
    new Loader({ apiKey, version: 'weekly' }).importLibrary('maps').then(async ({ Map }) => {
      await google.maps.importLibrary('geocoding');
      if (!alive || !mapEl.current) return;
      const has = value.lat != null && value.lng != null;
      const center = has ? { lat: value.lat!, lng: value.lng! } : { lat: -1.286, lng: 36.817 };
      map.current = new Map(mapEl.current, { center, zoom: has ? 15 : 6, streetViewControl: false, mapTypeControl: false });
      geocoder.current = new google.maps.Geocoder();
      try { await google.maps.importLibrary('places'); places.current = !!google.maps.places.AutocompleteSuggestion; } catch { placesOk.current = false; }
      marker.current = new google.maps.Marker({ map: map.current, position: center, draggable: true, visible: has });
      map.current.addListener('click', (e: google.maps.MapMouseEvent) => e.latLng && place(e.latLng.lat(), e.latLng.lng()));
      marker.current.addListener('dragend', (e: google.maps.MapMouseEvent) => e.latLng && place(e.latLng.lat(), e.latLng.lng()));
      setReady(true);
    }).catch(() => alive && setErr('Failed to load Google Maps.'));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Type-ahead suggestions (debounced). Search uses Places autocomplete, falling back to geocoder matches.
  useEffect(() => {
    const text = q.trim();
    if (!ready || mode === 'coords' || text.length < 2) { setSugs([]); return; }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      let list: Suggestion[] = [];
      if (mode === 'search' && places.current && placesOk.current) {
        try {
          const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: text, includedRegionCodes: ['ke'] });
          list = suggestions.slice(0, 6).flatMap((x) => x.placePrediction ? [{
            label: x.placePrediction.mainText?.text ?? x.placePrediction.text.text,
            sub: x.placePrediction.secondaryText?.text, req: { placeId: x.placePrediction.placeId },
          }] : []);
        } catch { placesOk.current = false; }
      }
      if (!list.length && mode === 'plus') {
        const short = /^[23456789CFGHJMPQRVWX]{2,4}\+[23456789CFGHJMPQRVWX]{0,3}$/i.test(text);
        if (short) list = TOWNS.map((town) => ({ label: `${text.toUpperCase()} ${town}`, sub: `Plus code near ${town}`, req: { address: `${text} ${town}` } }));
      }
      if (!list.length) {
        try {
          const { results } = await geocoder.current!.geocode({ address: text, region: 'ke' });
          list = results.slice(0, 6).map((r) => ({ label: mode === 'plus' ? pcOf(r) ?? r.formatted_address : r.formatted_address.split(',')[0], sub: r.formatted_address, req: { placeId: r.place_id } }));
        } catch { list = []; }
      }
      if (id === seq.current) { setSugs(list); setOpen(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode, ready]);

  const pick = async (s: Suggestion) => {
    setOpen(false); setQ(s.label); setErr(''); setBusy(true);
    try {
      const { results } = await geocoder.current!.geocode(s.req);
      const r = results[0]; if (!r) throw new Error('No match found');
      await place(r.geometry.location.lat(), r.geometry.location.lng(), pcOf(r));
      if (mode === 'search' && r.formatted_address) onAddress?.(r.formatted_address);
    } catch { setErr('Could not find that location'); } finally { setBusy(false); }
  };

  const find = async () => {
    setOpen(false);
    const text = q.trim(); if (!text || !geocoder.current) return;
    setErr(''); setBusy(true);
    try {
      if (mode === 'coords') {
        const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
        const lat = m ? +m[1] : NaN, lng = m ? +m[2] : NaN;
        if (!m || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Enter coordinates as "latitude, longitude"');
        await place(lat, lng);
      } else {
        const { results } = await geocoder.current.geocode({ address: text });
        const r = results[0]; if (!r) throw new Error('No match found');
        await place(r.geometry.location.lat(), r.geometry.location.lng(), pcOf(r));
        if (mode === 'search' && r.formatted_address) onAddress?.(r.formatted_address);
      }
    } catch (e) { setErr((e as Error).message?.includes('ZERO_RESULTS') ? 'No match found' : (e as Error).message || 'Location not found'); }
    finally { setBusy(false); }
  };

  const has = value.lat != null && value.lng != null;
  return (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setErr(''); setSugs([]); }}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="coords">Coordinates</TabsTrigger>
          <TabsTrigger value="plus">Plus code</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex gap-2">
        <div className="relative flex-1">
        <Input value={q} placeholder={HINTS[mode]} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter') { e.preventDefault(); if (open && sugs[0]) pick(sugs[0]); else find(); } }} />
        {open && sugs.length > 0 && mode !== 'coords' && (
          <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
            {sugs.map((s, i) => (
              <li key={i}><button type="button" className="w-full text-left px-3 py-2 hover:bg-muted flex gap-2 items-start"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0"><span className="block text-sm truncate">{s.label}</span>{s.sub && <span className="block text-xs text-muted-foreground truncate">{s.sub}</span>}</span>
              </button></li>
            ))}
          </ul>
        )}
        </div>
        <Button type="button" variant="outline" disabled={!ready || busy || !q.trim()} onClick={find}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="relative h-48 rounded-md overflow-hidden border border-border">
        <div ref={mapEl} className="w-full h-full" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center bg-muted text-xs text-muted-foreground">{err || 'Loading map…'}</div>}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />
          {has ? `${value.lat!.toFixed(6)}, ${value.lng!.toFixed(6)}${value.plusCode ? ` · ${value.plusCode}` : ''}` : 'No pin yet — search, or click the map'}</span>
        {has && <button type="button" className="flex items-center gap-0.5 hover:text-foreground"
          onClick={() => { marker.current?.setVisible(false); onChange({ lat: null, lng: null, plusCode: '' }); }}><X className="h-3 w-3" />Clear</button>}
      </div>
    </div>
  );
}
