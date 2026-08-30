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

export type TripOriginMode = "current" | "selected";

export type LiveTrip = {
  origin: LatLng;
  destination: LatLng;
  originLabel: string;
  destinationLabel: string;
  time: string;
  needs: PreferenceId[];
  originMode?: TripOriginMode;
};

export type UserFacingError = Error & { code?: string };

export const MADINAH_CENTER: LatLng = { lat: 24.4672, lon: 39.6112 };
export const MADINAH_SERVICE_RADIUS_METERS = 35_000;

export const madinahSuggestedPlaces = [
  "المسجد النبوي",
  "مسجد قباء",
  "مسجد القبلتين",
  "جبل أحد",
  "محطة قطار الحرمين المدينة المنورة",
] as const;

type SearchParamsLike = {
  get(name: string): string | null;
};

function isSafeArabicMessage(value?: string) {
  return Boolean(value && /[\u0600-\u06FF]/.test(value) && !/[A-Za-z]{4,}/.test(value));
}

function routingMessage(payload: { error?: string; code?: string } | null, status: number) {
  if (payload?.code === "OUTSIDE_SERVICE_AREA") {
    return {
      code: payload.code,
      message: "الرحلة خارج نطاق الخدمة الحالي. اختر نقطة بداية ووجهة داخل المدينة المنورة.",
    };
  }

  if (payload?.code === "ROUTING_UNAVAILABLE" || status >= 500) {
    return {
      code: payload?.code || "ROUTING_UNAVAILABLE",
      message: "ما قدرنا نلقى مسار مشي مناسب بين هالنقطتين الآن. حرّك البداية أو الوجهة شوي وجرب مرة ثانية.",
    };
  }

  if (status === 404) {
    return {
      code: payload?.code || "NO_ROUTE",
      message: "ما لقينا طريق مشي مناسب بين النقطتين. جرّب نقطة قريبة أو مدخل مختلف.",
    };
  }

  if (isSafeArabicMessage(payload?.error)) {
    return {
      code: payload?.code,
      message: payload!.error!,
    };
  }

  return {
    code: payload?.code || "ROUTE_ERROR",
    message: "تعذر تجهيز المسار الآن. تحقق من نقطة البداية والوجهة ثم جرّب مرة ثانية.",
  };
}

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
  const originLabel = params.get("fromLabel") || "نقطة البداية";
  const modeParam = params.get("originMode");
  const originMode: TripOriginMode =
    modeParam === "current" || modeParam === "selected"
      ? modeParam
      : originLabel === "موقعي الحالي"
        ? "current"
        : "selected";

  return {
    origin: { lat: fromLat, lon: fromLon },
    destination: { lat: toLat, lon: toLon },
    originLabel,
    destinationLabel: params.get("toLabel") || "الوجهة",
    time: params.get("time") || "الآن",
    needs,
    originMode,
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
    originMode: trip.originMode || (trip.originLabel === "موقعي الحالي" ? "current" : "selected"),
  });

  if (trip.needs.length) params.set("needs", trip.needs.join(","));
  return params;
}

export async function fetchLiveRoutes(trip: Pick<LiveTrip, "origin" | "destination" | "needs">) {
  const response = await fetch("/api/route-resilient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trip),
  });

  const payload = (await response.json().catch(() => null)) as
    | { routes?: LiveRoute[]; error?: string; code?: string }
    | null;

  if (!response.ok || !payload?.routes?.length) {
    const userMessage = routingMessage(payload, response.status);
    const error = new Error(userMessage.message) as UserFacingError;
    error.code = userMessage.code;
    throw error;
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

export function isWithinMadinahServiceArea(point: LatLng) {
  return haversineMeters(MADINAH_CENTER, point) <= MADINAH_SERVICE_RADIUS_METERS;
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

export function formatDuration(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} د`;

  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const parts: string[] = [];

  if (days) parts.push(`${days} ${days === 1 ? "يوم" : "يوم"}`);
  if (hours) parts.push(`${hours} س`);
  if (mins && parts.length < 2) parts.push(`${mins} د`);

  return parts.join(" ");
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} م`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 0 : 1)} كم`;
}
