export type LatLng = [number, number];

export type LocationFix = {
  lat: number;
  lon: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type RouteMode = "comfortable" | "balanced" | "fastest" | "heritage";

export type RouteManeuver = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  type: string;
  modifier?: string | null;
};

export type LiveRoute = {
  id: RouteMode;
  distanceMeters: number;
  durationSeconds: number;
  geometry: LatLng[];
  maneuvers: RouteManeuver[];
  viaLabel?: string | null;
  source: "valhalla";
};

export type TripContext = {
  start: LatLng | null;
  end: LatLng | null;
  fromLabel: string;
  toLabel: string;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
};

type SearchLike = { get(name: string): string | null };

function parseNumber(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTripContext(params: SearchLike): TripContext {
  const fromLat = parseNumber(params.get("fromLat"));
  const fromLon = parseNumber(params.get("fromLon"));
  const toLat = parseNumber(params.get("toLat"));
  const toLon = parseNumber(params.get("toLon"));

  return {
    start: fromLat !== null && fromLon !== null ? [fromLat, fromLon] : null,
    end: toLat !== null && toLon !== null ? [toLat, toLon] : null,
    fromLabel: params.get("fromLabel") || "موقع البداية",
    toLabel: params.get("toLabel") || "الوجهة",
  };
}

export function buildTripQuery({
  trip,
  time,
  needs,
  route,
}: {
  trip: TripContext;
  time: string;
  needs: string[];
  route?: string;
}) {
  const query = new URLSearchParams();
  query.set("time", time);
  if (needs.length) query.set("needs", needs.join(","));
  if (route) query.set("route", route);
  if (trip.start) {
    query.set("fromLat", trip.start[0].toFixed(6));
    query.set("fromLon", trip.start[1].toFixed(6));
  }
  if (trip.end) {
    query.set("toLat", trip.end[0].toFixed(6));
    query.set("toLon", trip.end[1].toFixed(6));
  }
  if (trip.fromLabel) query.set("fromLabel", trip.fromLabel);
  if (trip.toLabel) query.set("toLabel", trip.toLabel);
  return query.toString();
}

export async function geocodePlace(query: string): Promise<GeocodeResult> {
  const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.results?.length) throw new Error(payload?.error || "تعذر العثور على المكان.");
  return payload.results[0] as GeocodeResult;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const response = await fetch(`/api/geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.result) return { label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, lat, lon };
  return payload.result as GeocodeResult;
}

export function getBrowserLocation(options?: PositionOptions): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("المتصفح لا يدعم تحديد الموقع."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
        speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
        timestamp: position.timestamp,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "اسمح للموقع باستخدام GPS من إعدادات المتصفح ثم حاول مرة أخرى."
          : error.code === error.TIMEOUT
            ? "استغرق تحديد الموقع وقتًا أطول من المتوقع. حاول مرة أخرى في مكان مفتوح."
            : "تعذر الحصول على موقعك الحالي.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000, ...options },
    );
  });
}

export async function fetchWalkingRoute({ start, end, mode, needs }: { start: LatLng; end: LatLng; mode: RouteMode; needs: string[] }): Promise<LiveRoute> {
  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end, mode, needs }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.route) throw new Error(payload?.error || "تعذر حساب مسار المشي.");
  return payload.route as LiveRoute;
}

export function haversineMeters(a: LatLng, b: LatLng) {
  const earth = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function polylineLength(points: LatLng[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += haversineMeters(points[index - 1], points[index]);
  return total;
}

export function nearestRoutePoint(location: LatLng, geometry: LatLng[]) {
  if (!geometry.length) return { index: 0, distance: Number.POSITIVE_INFINITY };
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  geometry.forEach((point, index) => {
    const distance = haversineMeters(location, point);
    if (distance < bestDistance) { bestDistance = distance; bestIndex = index; }
  });
  return { index: bestIndex, distance: bestDistance };
}

export function routeProgress(location: LatLng, route: LiveRoute) {
  if (route.geometry.length < 2) return { progress: 0, remainingMeters: route.distanceMeters, offRouteMeters: Number.POSITIVE_INFINITY, walkedMeters: 0 };
  const nearest = nearestRoutePoint(location, route.geometry);
  const totalGeometryLength = polylineLength(route.geometry) || route.distanceMeters || 1;
  const walkedGeometry = polylineLength(route.geometry.slice(0, nearest.index + 1));
  const ratio = Math.min(1, Math.max(0, walkedGeometry / totalGeometryLength));
  const remainingMeters = Math.max(0, route.distanceMeters * (1 - ratio));
  return { progress: Math.round(ratio * 100), remainingMeters, offRouteMeters: nearest.distance, walkedMeters: Math.max(0, route.distanceMeters - remainingMeters) };
}

export function activeManeuver(route: LiveRoute, walkedMeters: number) {
  if (!route.maneuvers.length) return null;
  let cumulative = 0;
  for (const maneuver of route.maneuvers) {
    cumulative += maneuver.distanceMeters;
    if (walkedMeters <= cumulative) return { ...maneuver, remainingToManeuverMeters: Math.max(0, cumulative - walkedMeters) };
  }
  return { ...route.maneuvers[route.maneuvers.length - 1], remainingToManeuverMeters: 0 };
}

export function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.max(0, Math.round(meters / 10) * 10)} م`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} كم`;
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} س ${rest} د` : `${hours} س`;
}
