import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { getDirectory, GetDirectoryOutputType } from 'zitejs/api';
import { MapPin } from 'lucide-react';
import { money } from '../lib/util';
import PageHeader from '../components/PageHeader';

type C = GetDirectoryOutputType['customers'][0];

export default function CustomerMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading map…');
  const [located, setLocated] = useState<{ c: C; ok: boolean }[]>([]);
  const apiKey = import.meta.env.VITE_GOOGLEMAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey) { setStatus('Google Maps is not connected.'); return; }
    let mounted = true;
    (async () => {
      try {
        const loader = new Loader({ apiKey, version: 'weekly' });
        const [{ Map, InfoWindow }, { Geocoder }, dir] = await Promise.all([
          loader.importLibrary('maps'), loader.importLibrary('geocoding'), getDirectory({}),
        ]);
        if (!mounted || !mapRef.current) return;
        const map = new Map(mapRef.current, { center: { lat: -1.286, lng: 36.817 }, zoom: 3 });
        const geocoder = new Geocoder();
        const info = new InfoWindow();
        const bounds = new google.maps.LatLngBounds();
        const results: { c: C; ok: boolean }[] = [];
        for (const c of dir.customers) {
          if (c.lat == null && !c.address.trim()) { results.push({ c, ok: false }); continue; }
          try {
            const loc = c.lat != null && c.lng != null
              ? new google.maps.LatLng(c.lat, c.lng)
              : (await geocoder.geocode({ address: c.address })).results[0]?.geometry.location;
            if (!loc) { results.push({ c, ok: false }); continue; }
            const marker = new google.maps.Marker({ position: loc, map, title: c.company });
            marker.addListener('click', () => {
              info.setContent(`<div style="color:#111"><strong>${c.company}</strong><br/>Balance ${money(c.balance)}<br/>${c.address}</div>`);
              info.open({ map, anchor: marker });
            });
            bounds.extend(loc);
            results.push({ c, ok: true });
          } catch { results.push({ c, ok: false }); }
        }
        if (!mounted) return;
        if (!bounds.isEmpty()) map.fitBounds(bounds);
        setLocated(results);
        setStatus('');
      } catch { if (mounted) setStatus('Failed to load Google Maps.'); }
    })();
    return () => { mounted = false; };
  }, [apiKey]);

  return (
    <div>
      <PageHeader title="Addresses" subtitle="Pins use each customer's saved location pin, or their shipping address if no pin is set." />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className="relative h-[calc(100vh-8rem)] min-h-[420px] rounded-lg overflow-hidden border border-border">
          <div ref={mapRef} className="w-full h-full" />
          {status && <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-muted-foreground">{status}</div>}
        </div>
        <div className="bg-card border border-border rounded-lg p-3 max-h-[calc(100vh-8rem)] overflow-y-auto space-y-2">
          {located.map(({ c, ok }) => (
            <div key={c.id} className="flex gap-2 text-sm border-b border-border pb-2">
              <MapPin className={`h-4 w-4 mt-0.5 shrink-0 ${ok ? 'text-secondary' : 'text-muted-foreground'}`} />
              <div><div className="font-medium">{c.company}</div><div className="text-xs text-muted-foreground">{ok ? c.address : 'Address missing or not found'}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
