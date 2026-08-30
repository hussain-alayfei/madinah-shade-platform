import { NextResponse } from "next/server";
import type { LatLng, LiveManeuver, LiveRoute } from "@/lib/maps";
import { haversineMeters, isWithinMadinahServiceArea } from "@/lib/maps";

const OSRM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";

type RouteBody = {
  origin?: LatLng;
  destination?: LatLng;
};

type OsrmStep = {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
    location?: [number, number];
  };
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: Array<{ steps?: OsrmStep[] }>;
  }>;
  message?: string;
};

function validPoint(point?: LatLng): point is LatLng {
  return Boolean(
    point &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lon) <= 180,
  );
}

function instruction(step: OsrmStep) {
  const street = step.name?.trim();
  const suffix = street ? ` نحو ${street}` : "";
  const type = step.maneuver?.type || "";
  const modifier = step.maneuver?.modifier || "";

  if (type === "depart") return `ابدأ المشي${suffix}`;
  if (type === "arrive") return "وصلت إلى وجهتك";
  if (modifier.includes("right")) return `اتجه يمينًا${suffix}`;
  if (modifier.includes("left")) return `اتجه يسارًا${suffix}`;
  if (modifier === "uturn") return "ارجع للخلف عند أول فرصة مناسبة";
  return street ? `استمر نحو ${street}` : "استمر على مسار المشاة";
}

function nearestCoordinateIndex(coordinates: [number, number][], point?: [number, number]) {
  if (!point || !coordinates.length) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const target = { lat: point[1], lon: point[0] };

  coordinates.forEach(([lat, lon], index) => {
    const distance = haversineMeters({ lat, lon }, target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RouteBody;
    if (!validPoint(body.origin) || !validPoint(body.destination)) {
      return NextResponse.json({ error: "تعذر قراءة نقطة البداية أو الوجهة." }, { status: 400 });
    }

    if (!isWithinMadinahServiceArea(body.origin) || !isWithinMadinahServiceArea(body.destination)) {
      return NextResponse.json({ code: "OUTSIDE_SERVICE_AREA", error: "الرحلة خارج نطاق الخدمة الحالي." }, { status: 422 });
    }

    const url = new URL(
      `${OSRM_FOOT_URL}/${body.origin.lon},${body.origin.lat};${body.destination.lon},${body.destination.lat}`,
    );
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("steps", "true");
    url.searchParams.set("alternatives", "false");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "MadinahShade/0.4 (+https://madinah-shade-platform.vercel.app)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => ({}))) as OsrmResponse;
    const result = payload.routes?.[0];
    const rawCoordinates = result?.geometry?.coordinates || [];

    if (!response.ok || payload.code !== "Ok" || !result || rawCoordinates.length < 2) {
      return NextResponse.json({ code: "ROUTING_UNAVAILABLE", error: "تعذر حساب مسار المشي الآن." }, { status: 502 });
    }

    const coordinates: [number, number][] = rawCoordinates.map(([lon, lat]) => [lat, lon]);
    const steps = result.legs?.flatMap((leg) => leg.steps || []) || [];
    const maneuvers: LiveManeuver[] = steps.map((step, index) => {
      const begin = nearestCoordinateIndex(coordinates, step.maneuver?.location);
      const next = steps[index + 1];
      const end = next ? nearestCoordinateIndex(coordinates, next.maneuver?.location) : coordinates.length - 1;
      return {
        instruction: instruction(step),
        distanceMeters: Math.round(step.distance || 0),
        timeSeconds: Math.round(step.duration || 0),
        beginShapeIndex: begin,
        endShapeIndex: Math.max(begin, end),
      };
    });

    const distanceMeters = Math.round(result.distance || 0);
    const route: LiveRoute = {
      id: "fastest",
      name: "المسار المتاح",
      description: "مسار مشي مباشر متاح إلى وجهتك.",
      profileReason: "مسار مشي متاح حاليًا",
      durationMinutes: Math.max(1, Math.round((result.duration || 0) / 60)),
      distanceMeters,
      coordinates,
      maneuvers,
      comfortScore: Math.max(55, Math.min(82, Math.round(82 - Math.max(0, distanceMeters - 1200) / 500))),
      wheelchairAware: false,
      source: "city-routing-fallback",
    };

    return NextResponse.json({ routes: [route], distinct: true, limitedAlternatives: true });
  } catch {
    return NextResponse.json({ code: "ROUTING_UNAVAILABLE", error: "تعذر حساب مسار المشي الآن." }, { status: 502 });
  }
}
