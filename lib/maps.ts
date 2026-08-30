import type { PreferenceId } from "@/lib/data";

export type LatLng = {
  lat: number;
  lon: number;
};

export type UserPosition = LatLng & {
  accuracy?: number;
};

export type LiveManeuver = {
  instruction: string;
  distanceMeters: number;
  timeSeconds: number;
  beginShapeIndex: number;
  endShapeIndex: number;
};

export type LiveRoute = {
  id: "comfortable" | "balanced" | "fastest";
  name: string;
  description: string;
  profileReason: string;
  durationMinutes: number;
  distanceMeters: number;
  coordinates: [number, number][];
  maneuvers: LiveManeuver[];
  comfortScore: number;
  wheelchairAware: boolean;
  source: string;
};

export type LiveTrip = {
  origin: LatLng;
  destination: LatLng;
  originLabel: string;
  destinationLabel: string;
  time: string;
  needs: PreferenceId[];
};

type SearchParamsLike = {
  get(name: string): string | null;
};

export function parseLiveTrip(params: SearchParamsLike): LiveTrip | null {
  const fromLat = Number(params.get("fromLat"));
  const fromLon = Number(params.get("fromLon"));
  const toLat = Number(params.get("toLat"));
  const toLon = Number(params.get("toLon"));

  if (![fromLat, fromLon, toLat, toLon].every(Number.isFinite)) return null;
  if (Math.abs(fromLat) > 90 || Math.abs(toLat) > 90 || Math.abs(fromLon) > 180 || Math.abs(toLon) > 180) return null;

  const needsValue = params.get("needs");
  const allowed = new Set<PreferenceId>(["wheelchair", "senior", "shade", "lowCrowd", "rest"]);
  const needs = (needsValue ? needsValue.split(",") : []).filter((item): item is PreferenceId =>
    allowed.has(item as PreferenceId),
  );

  return {
    origin: { lat: fromLat, lon: fromLon },
    destination: { lat: toLat, lon: toLon },
    originLabel: params.get("fromLabel") || "نقطة البداية",
    destinationLabel: params.get("toLabel") || "الوجهة",
    time: params.get("time") || "الآن",
    needs,
  };
}

export function tripToSearchParams(trip: LiveTrip) {
  const params = new URLSearchParams({
    fromLat: String(trip.origin.lat),
    fromLon: String(trip.origin.lon),
    toLat: String(trip.destination.lat),
    toLon: String(trip.destination.lon),
    fromLabel: trip.originLabel,
    toLabel: trip.destinationLabel,
    time: trip.time,
  });

  if (trip.needs.length) params.set("needs", trip.needs.join(","));
  return params;
}

export async function fetchLiveRoutes(trip: Pick<LiveTrip, "origin" | "destination" | "needs">) {
  const response = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trip),
  });

  const payload = (await response.json().catch(() => null)) as
    | { routes?: LiveRoute[]; error?: string }
    | null;

  if (!response.ok || !payload?.routes?.length) {
    throw new Error(payload?.error || "تعذر حساب مسار المشي الآن.");
  }

  return payload.routes;
}

export function haversineMeters(a: LatLng, b: LatLng) {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function nearestRoutePoint(coordinates: [number, number][], position: LatLng) {
  let index = 0;
  let distance = Number.POSITIVE_INFINITY;

  coordinates.forEach(([lat, lon], candidateIndex) => {
    const currentDistance = haversineMeters(position, { lat, lon });
    if (currentDistance < distance) {
      distance = currentDistance;
      index = candidateIndex;
    }
  });

  return { index, distance };
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} م`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} كم`;
}
