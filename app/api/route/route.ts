import { NextResponse } from "next/server";
import type { PreferenceId } from "@/lib/data";
import {
  haversineMeters,
  isWithinMadinahServiceArea,
  nearestRoutePoint,
  type LatLng,
  type LiveManeuver,
  type LiveRoute,
} from "@/lib/maps";

const ROUTE_SERVICE_URL = "https://valhalla1.openstreetmap.de/route";
const CLIENT_ID = "madinah-shade-platform.vercel.app";

type RouteRequestBody = {
  origin?: LatLng;
  destination?: LatLng;
  needs?: PreferenceId[];
};

type RouteProfile = {
  id: LiveRoute["id"];
  name: string;
  description: string;
  profileReason: string;
  options: Record<string, number>;
};

type ServiceManeuver = {
  type?: number;
  length?: number;
  time?: number;
  begin_shape_index?: number;
  end_shape_index?: number;
  street_names?: string[];
};

type ServiceLeg = {
  shape?: string;
  maneuvers?: ServiceManeuver[];
};

type ServiceResponse = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: ServiceLeg[];
  };
  error?: string;
};

const profiles: Record<LiveRoute["id"], RouteProfile> = {
  comfortable: {
    id: "comfortable",
    name: "المسار الأريح",
    description: "يفضّل ممرات المشاة والأرصفة ويقلل الدرج والطرق الخدمية قدر الإمكان.",
    profileReason: "أولوية أعلى لجودة بيئة المشي",
    options: {
      walkway_factor: 0.55,
      sidewalk_factor: 0.55,
      alley_factor: 6,
      driveway_factor: 9,
      step_penalty: 150,
      use_hills: 0.1,
    },
  },
  balanced: {
    id: "balanced",
    name: "المسار المتوازن",
    description: "يحافظ على زمن مناسب مع محاولة استخدام شبكة مشي مختلفة عن المسار المباشر.",
    profileReason: "توازن بين الزمن وجودة الطريق",
    options: {
      walkway_factor: 0.78,
      sidewalk_factor: 0.78,
      alley_factor: 3,
      driveway_factor: 6,
      step_penalty: 70,
      use_hills: 0.3,
    },
  },
  fastest: {
    id: "fastest",
    name: "المسار الأسرع",
    description: "أقرب مسار مشي مباشر متاح إلى وجهتك.",
    profileReason: "أولوية أعلى لزمن الوصول",
    options: {
      walkway_factor: 1,
      sidewalk_factor: 1,
      alley_factor: 2,
      driveway_factor: 5,
      step_penalty: 25,
      use_hills: 0.5,
    },
  },
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

function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lon += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lat / 1e6, lon / 1e6]);
  }

  return coordinates;
}

function arabicInstruction(maneuver: ServiceManeuver) {
  const street = maneuver.street_names?.[0];
  const streetText = street ? ` نحو ${street}` : "";

  switch (maneuver.type) {
    case 1:
    case 2:
    case 3:
      return `ابدأ المشي${streetText}`;
    case 4:
    case 5:
    case 6:
      return "وصلت إلى وجهتك";
    case 8:
    case 22:
      return `استمر مباشرة${streetText}`;
    case 9:
    case 10:
    case 11:
    case 18:
    case 20:
    case 23:
      return `اتجه يمينًا${streetText}`;
    case 14:
    case 15:
    case 16:
    case 19:
    case 21:
    case 24:
      return `اتجه يسارًا${streetText}`;
    case 12:
    case 13:
      return "قم بالالتفاف للخلف عند أول فرصة مناسبة";
    case 17:
      return `استمر على الممر${streetText}`;
    case 25:
      return `اندمج مع المسار${streetText}`;
    case 26:
      return "ادخل الدوار واتبع مسار المشاة";
    case 27:
      return `اخرج من الدوار${streetText}`;
    default:
      return street ? `استمر نحو ${street}` : "استمر على مسار المشاة";
  }
}

function continuingInstruction(maneuver: ServiceManeuver) {
  const street = maneuver.street_names?.[0];
  return street ? `استمر نحو ${street}` : "استمر على المسار";
}

function comfortScore(id: LiveRoute["id"], distanceMeters: number, needs: PreferenceId[]) {
  const base = id === "comfortable" ? 90 : id === "balanced" ? 82 : 74;
  const distancePenalty = Math.min(10, Math.max(0, (distanceMeters - 1200) / 350));
  let score = base - distancePenalty;

  if (needs.includes("wheelchair")) score += id === "comfortable" ? 4 : id === "balanced" ? 2 : 0;
  if (needs.includes("senior")) score += id === "comfortable" ? 3 : 0;

  return Math.max(50, Math.min(97, Math.round(score)));
}

function makeViaCandidates(origin: LatLng, destination: LatLng) {
  const latitude = (origin.lat + destination.lat) / 2;
  const longitude = (origin.lon + destination.lon) / 2;
  const metersPerLat = 111_320;
  const metersPerLon = 111_320 * Math.cos((latitude * Math.PI) / 180);
  const east = (destination.lon - origin.lon) * metersPerLon;
  const north = (destination.lat - origin.lat) * metersPerLat;
  const length = Math.max(1, Math.hypot(east, north));
  const perpendicularEast = -north / length;
  const perpendicularNorth = east / length;
  const tripDistance = haversineMeters(origin, destination);
  const baseOffset = Math.min(260, Math.max(85, tripDistance * 0.18));

  function offsetPoint(side: number, multiplier: number): LatLng {
    const offset = baseOffset * multiplier * side;
    return {
      lat: latitude + (perpendicularNorth * offset) / metersPerLat,
      lon: longitude + (perpendicularEast * offset) / metersPerLon,
    };
  }

  return {
    positive: [offsetPoint(1, 1), offsetPoint(1, 1.55), offsetPoint(1, 0.7)],
    negative: [offsetPoint(-1, 1), offsetPoint(-1, 1.55), offsetPoint(-1, 0.7)],
  };
}

function pathsOverlap(a: [number, number][], b: [number, number][]) {
  if (!a.length || !b.length) return false;
  const step = Math.max(1, Math.floor(a.length / 18));
  let sampled = 0;
  let close = 0;

  for (let index = 0; index < a.length; index += step) {
    const [lat, lon] = a[index];
    sampled += 1;
    if (nearestRoutePoint(b, { lat, lon }).distance <= 22) close += 1;
  }

  return sampled > 0 && close / sampled >= 0.88;
}

function isDuplicateRoute(candidate: LiveRoute, existing: LiveRoute[]) {
  return existing.some(
    (route) =>
      pathsOverlap(candidate.coordinates, route.coordinates) &&
      pathsOverlap(route.coordinates, candidate.coordinates),
  );
}

function combineLegs(legs: ServiceLeg[]) {
  const coordinates: [number, number][] = [];
  const maneuvers: LiveManeuver[] = [];

  legs.forEach((leg, legIndex) => {
    const legCoordinates = decodePolyline6(leg.shape || "");
    if (!legCoordinates.length) return;

    const previous = coordinates[coordinates.length - 1];
    const first = legCoordinates[0];
    const sharesPoint = Boolean(
      previous &&
        Math.abs(previous[0] - first[0]) < 0.000001 &&
        Math.abs(previous[1] - first[1]) < 0.000001,
    );
    const baseIndex = sharesPoint ? coordinates.length - 1 : coordinates.length;
    coordinates.push(...(sharesPoint ? legCoordinates.slice(1) : legCoordinates));

    (leg.maneuvers || []).forEach((maneuver) => {
      const isIntermediateArrival = legIndex < legs.length - 1 && [4, 5, 6].includes(maneuver.type || -1);
      if (isIntermediateArrival) return;
      const isRestartAtVia = legIndex > 0 && [1, 2, 3].includes(maneuver.type || -1);
      maneuvers.push({
        instruction: isRestartAtVia ? continuingInstruction(maneuver) : arabicInstruction(maneuver),
        distanceMeters: Math.round((maneuver.length || 0) * 1000),
        timeSeconds: Math.round(maneuver.time || 0),
        beginShapeIndex: baseIndex + (maneuver.begin_shape_index || 0),
        endShapeIndex: baseIndex + (maneuver.end_shape_index || 0),
      });
    });
  });

  return { coordinates, maneuvers };
}

async function requestRoute(
  profile: RouteProfile,
  origin: LatLng,
  destination: LatLng,
  needs: PreferenceId[],
  via?: LatLng,
): Promise<LiveRoute> {
  const wheelchair = needs.includes("wheelchair");
  const pedestrianOptions: Record<string, string | number> = {
    ...profile.options,
    type: wheelchair ? "wheelchair" : "foot",
  };

  if (needs.includes("senior")) {
    pedestrianOptions.walking_speed = 4.2;
    pedestrianOptions.step_penalty = Math.max(Number(pedestrianOptions.step_penalty || 0), 180);
    pedestrianOptions.use_hills = 0.1;
  }

  if (wheelchair) {
    pedestrianOptions.walking_speed = 4;
    pedestrianOptions.step_penalty = 600;
    pedestrianOptions.use_hills = 0;
  }

  const locations = [
    { lat: origin.lat, lon: origin.lon, type: "break" },
    ...(via ? [{ lat: via.lat, lon: via.lon, type: "break" }] : []),
    { lat: destination.lat, lon: destination.lon, type: "break" },
  ];

  const response = await fetch(ROUTE_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": CLIENT_ID,
      "User-Agent": "MadinahShade/0.3 (+https://madinah-shade-platform.vercel.app)",
    },
    body: JSON.stringify({
      locations,
      costing: "pedestrian",
      costing_options: { pedestrian: pedestrianOptions },
      units: "kilometers",
      language: "en-US",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => ({}))) as ServiceResponse;
  const legs = payload.trip?.legs || [];

  if (!response.ok || !legs.length || legs.some((leg) => !leg.shape)) {
    throw new Error(payload.error || `تعذر حساب ${profile.name}.`);
  }

  const { coordinates, maneuvers } = combineLegs(legs);
  const distanceMeters = Math.round((payload.trip?.summary?.length || 0) * 1000);
  const durationMinutes = Math.max(1, Math.round((payload.trip?.summary?.time || 0) / 60));

  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    profileReason: profile.profileReason,
    durationMinutes,
    distanceMeters,
    coordinates,
    maneuvers,
    comfortScore: comfortScore(profile.id, distanceMeters, needs),
    wheelchairAware: wheelchair,
    source: "city-routing",
  };
}

async function findDistinctVariant(
  profile: RouteProfile,
  origin: LatLng,
  destination: LatLng,
  needs: PreferenceId[],
  vias: LatLng[],
  existing: LiveRoute[],
  directDistance: number,
) {
  const candidates: Array<LatLng | undefined> = [undefined, ...vias];

  for (const via of candidates) {
    try {
      const route = await requestRoute(profile, origin, destination, needs, via);
      if (route.distanceMeters > directDistance * 1.85) continue;
      if (!isDuplicateRoute(route, existing)) return route;
    } catch {
      // Try the next candidate. A snapped via point may not be walkable.
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RouteRequestBody;
    const origin = body.origin;
    const destination = body.destination;
    const needs = Array.isArray(body.needs) ? body.needs : [];

    if (!validPoint(origin) || !validPoint(destination)) {
      return NextResponse.json({ error: "تعذر قراءة نقطة البداية أو الوجهة." }, { status: 400 });
    }

    if (!isWithinMadinahServiceArea(origin) || !isWithinMadinahServiceArea(destination)) {
      return NextResponse.json(
        {
          code: "OUTSIDE_SERVICE_AREA",
          error: "نطاق التجربة الحالي داخل المدينة المنورة. اختر نقطة بداية ووجهة داخل المدينة للمتابعة.",
        },
        { status: 422 },
      );
    }

    const straightLine = haversineMeters(origin, destination);
    if (straightLine < 15) {
      return NextResponse.json({ error: "البداية والوجهة متقاربتان جدًا." }, { status: 400 });
    }
    if (straightLine > 30_000) {
      return NextResponse.json({ error: "المسافة كبيرة على تجربة المشي الحالية. اختر نقطتين أقرب داخل المدينة." }, { status: 422 });
    }

    const fastest = await requestRoute(profiles.fastest, origin, destination, needs);
    const routes: LiveRoute[] = [fastest];
    const viaCandidates = makeViaCandidates(origin, destination);

    const comfortable = await findDistinctVariant(
      profiles.comfortable,
      origin,
      destination,
      needs,
      [...viaCandidates.positive, ...viaCandidates.negative],
      routes,
      fastest.distanceMeters,
    );
    if (comfortable) routes.push(comfortable);

    const balanced = await findDistinctVariant(
      profiles.balanced,
      origin,
      destination,
      needs,
      [...viaCandidates.negative, ...viaCandidates.positive],
      routes,
      fastest.distanceMeters,
    );
    if (balanced) routes.push(balanced);

    routes.sort((a, b) => {
      if (needs.includes("wheelchair") || needs.includes("senior")) return b.comfortScore - a.comfortScore;
      const order: Record<LiveRoute["id"], number> = { comfortable: 0, balanced: 1, fastest: 2 };
      return order[a.id] - order[b.id];
    });

    return NextResponse.json({
      routes,
      distinct: true,
      limitedAlternatives: routes.length < 3,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "تعذر حساب مسارات المشي الآن.",
        code: "ROUTING_UNAVAILABLE",
      },
      { status: 502 },
    );
  }
}
