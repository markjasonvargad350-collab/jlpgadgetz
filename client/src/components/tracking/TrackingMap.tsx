import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { milestoneIndex, SIMULATED_LABEL } from '../../config/delivery';
import type { GeoPoint, ShipmentDTO } from '../../types/order';

/**
 * Simulated delivery map. Draws the fixed reference route (warehouse → hub →
 * destination) as a solid "travelled" leg + a dashed "remaining" leg, and eases
 * a courier marker along the travelled path with a single requestAnimationFrame
 * loop (imperative setLatLng — no per-frame React state). Honours
 * `prefers-reduced-motion` with a static marker.
 *
 * ⚠️  NOT REAL GPS — client-side easing over a server-defined simulated route.
 * Default-exported so it can be `React.lazy`-split (Leaflet is heavy).
 */

// ── Leaflet marker glyphs — inline-styled divIcons, so NO default marker asset
// is requested (sidesteps the well-known Vite/Leaflet icon-404). ──
function dotIcon(color: string, size = 15): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(255,255,255,.95),0 1px 5px rgba(0,0,0,.3)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const ORIGIN_ICON = dotIcon('#fb923c'); // brand
const HUB_ICON = dotIcon('#8b5cf6'); // violet
const DEST_ICON = dotIcon('#10b981'); // emerald
const COURIER_ICON = L.divIcon({
  className: '',
  html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:#fff;box-shadow:0 2px 9px rgba(0,0,0,.38);font-size:16px;line-height:1">🚚</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A point a fraction `frac` (0..1) along a multi-segment path (equal-weight segments). */
function pointAlong(path: GeoPoint[], frac: number): GeoPoint {
  if (path.length === 1) return path[0];
  const segs = path.length - 1;
  const scaled = Math.min(Math.max(frac, 0), 1) * segs;
  const i = Math.min(Math.floor(scaled), segs - 1);
  const t = scaled - i;
  return { lat: lerp(path[i].lat, path[i + 1].lat, t), lng: lerp(path[i].lng, path[i + 1].lng, t) };
}

/** Drop consecutive duplicate coordinates (the route repeats the warehouse point). */
function dedupe(pts: GeoPoint[]): GeoPoint[] {
  const out: GeoPoint[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.lat !== p.lat || last.lng !== p.lng) out.push(p);
  }
  return out;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Fit the map to the whole route once (and whenever the route changes). */
function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14 });
  }, [map, points]);
  return null;
}

/** The courier marker + its animation. Isolated so the rAF effect owns one marker. */
function CourierMarker({ path, reducedMotion }: { path: GeoPoint[]; reducedMotion: boolean }) {
  const ref = useRef<L.Marker>(null);

  useEffect(() => {
    const marker = ref.current;
    if (!marker || path.length === 0) return;

    if (reducedMotion || path.length === 1) {
      const end = path[path.length - 1];
      marker.setLatLng([end.lat, end.lng]);
      return;
    }

    const totalMs = Math.min(3200, 850 * (path.length - 1));
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / totalMs);
      const p = pointAlong(path, easeInOutCubic(t));
      marker.setLatLng([p.lat, p.lng]);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [path, reducedMotion]);

  const initial = reducedMotion ? path[path.length - 1] : path[0];
  return (
    <Marker ref={ref} position={[initial.lat, initial.lng]} icon={COURIER_ICON} zIndexOffset={1000}>
      <Tooltip direction="top" offset={[0, -16]}>
        Courier (simulated)
      </Tooltip>
    </Marker>
  );
}

export default function TrackingMap({ shipment }: { shipment: ShipmentDTO }) {
  const reducedMotion = usePrefersReducedMotion();
  const { origin, destination, current, route } = shipment;

  // Everything the map draws, recomputed only when the shipment's geo actually
  // changes. Keyed on a serialized signature (not the raw arrays) so a polling
  // re-fetch with identical data keeps a stable identity → the courier
  // animation and bounds-fit don't restart on every poll.
  const signature =
    `${route.map((r) => `${r.status}:${r.lat},${r.lng}`).join('|')}` +
    `#${current ? `${current.lat},${current.lng}` : 'none'}` +
    `#${shipment.history.length ? shipment.history[shipment.history.length - 1].status : ''}`;

  const view = useMemo(() => {
    if (route.length === 0) return null;
    const lastStatus = shipment.history.length
      ? shipment.history[shipment.history.length - 1].status
      : route[0].status;
    const idx = milestoneIndex(lastStatus); // -1 for CANCELLED (off-route)

    const traversedRoute = idx >= 0 ? route.slice(0, idx + 1) : [route[0]];
    const remainingRoute = idx >= 0 ? route.slice(idx) : route;
    const traversed = dedupe(traversedRoute.map((r) => ({ lat: r.lat, lng: r.lng })));
    const remaining = dedupe(remainingRoute.map((r) => ({ lat: r.lat, lng: r.lng })));
    const all = dedupe(route.map((r) => ({ lat: r.lat, lng: r.lng })));
    return { traversed, remaining, all };
  }, [signature]); // eslint-disable-line -- signature fully captures route/current/status

  // Null-coordinate guard — a shipment could predate the geo simulation.
  if (!origin || !destination || !current || !view) {
    return (
      <div className="grid h-80 place-items-center rounded-3xl bg-white/50 text-sm text-ink-soft ring-1 ring-white/60">
        Map unavailable for this shipment.
      </div>
    );
  }

  const center: [number, number] = [origin.lat, origin.lng];

  return (
    <div className="relative z-0 isolate h-80 overflow-hidden rounded-3xl ring-1 ring-white/60">
      <span className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-ink-soft shadow-sm backdrop-blur">
        {SIMULATED_LABEL}
      </span>
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ background: '#eef2f6' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c', 'd']}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <FitBounds points={view.all} />

        {view.traversed.length > 1 && (
          <Polyline
            positions={view.traversed.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#f97316', weight: 4, opacity: 0.9 }}
          />
        )}
        {view.remaining.length > 1 && (
          <Polyline
            positions={view.remaining.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#94a3b8', weight: 3, opacity: 0.85, dashArray: '6 9' }}
          />
        )}

        <Marker position={[origin.lat, origin.lng]} icon={ORIGIN_ICON}>
          <Tooltip>iStore Warehouse</Tooltip>
        </Marker>
        <Marker position={[destination.lat, destination.lng]} icon={DEST_ICON}>
          <Tooltip>Destination</Tooltip>
        </Marker>
        {/* Hub marker: the middle distinct point, when the route has one. */}
        {view.all.length >= 3 && (
          <Marker position={[view.all[1].lat, view.all[1].lng]} icon={HUB_ICON}>
            <Tooltip>Distribution hub</Tooltip>
          </Marker>
        )}

        <CourierMarker path={view.traversed} reducedMotion={reducedMotion} />
      </MapContainer>
    </div>
  );
}
