import { NextResponse } from "next/server";
import type { PreferenceId } from "@/lib/data";
import { haversineMeters, type LatLng, type LiveManeuver, type LiveRoute } from "@/lib/maps";

const VALHALLA_ROUTE_URL = "https://valhalla1.openstreetmap.de/route";
const CLIENT_ID = "madinah-shade-platform.vercel.app";

type RouteRequestBody = {
  origin?: LatLng;
  destination?: LatLng;
  needs?: PreferenceId[];
};

type ValhallaManeuver = {
  type?: number;
  instruction?: string;
  length?: number;
  time?: number;
  begin_shape_index?: number;
  end_shape_index?: number;
  street_names?: string[];
};

type ValhallaResponse = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: Array<{
      shape?: string;
      maneuvers?: ValhallaManeuver[];
    }>;
  };
  error?: string;
  error_code?: number;
};

const profiles: Array<{
  id: LiveRoute["id"];
  name: string;
  description: string;
  profileReason: string;
  options: Record<string, number>;
}> = [
  {
    id: "comfortable",
    name: "المسار الأريح",
    description: "يفضّل ممرات المشاة والأرصفة ويتجنب الدرج والطرق الخدمية قدر الإمكان.",
    profileReason: "أولوية للأرصفة والممرات وتقليل الدرج",
    options: {
      walkway_factor: 0.6,
      sidewalk_factor: 0.6,
      alley_factor: 5,
      driveway_factor: 8,
      step_penalty: 120,
      use_hills: 0.15,
    },
  },
  {
    id: "balanced",
    name: "المسار المتوازن",
    description: "يوازن بين وقت الوصول وجودة بيئة المشي المتاحة في بيانات OpenStreetMap.",
    profileReason: "توازن بين الزمن وجودة مسار المشاة",
    options: {
      walkway_factor: 0.82,
      sidewalk_factor: 0.82,
      alley_factor: 3,
      driveway_factor: 6,
      step_penalty: 60,
      use_hills: 0.35,
    },
  },
  {
    id: "fastest",
    name: "المسار الأسرع",
    description: "يعتمد إعداد المشي القياسي للحصول على مسار مباشر بزمن أقل عندما تسمح الشبكة.",
    profileReason: "أولوية أعلى لزمن الوصول",
    options: {
      walkway_factor: 1,
      sidewalk_factor: 1,
      alley_factor: 2,
      driveway_factor: 5,
      step_penalty: 30,
      use_hills: 0.5,
    },
  },
];

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

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    const deltaLon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += deltaLon;

    coordinates.push([lat / 1e6, lon / 1e6]);
  }

  return coordinates;
}

function ArabicInstruction(maneuver: ValhallaManeuver) {
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

function comfortScore(id: LiveRoute["id"], distanceMeters: number, needs: PreferenceId[]) {
  const base = id === "comfortable" ? 90 : id === "balanced" ? 82 : 74;
  const distancePenalty = Math.min(10, Math.max(0, (distanceMeters - 1200) / 350));
  let score = base - distancePenalty;

  if (needs.includes("wheelchair")) score += id === "comfortable" ? 4 : id === "balanced" ? 2 : 0;
  if (needs.includes("senior")) score += id === "comfortable" ? 3 : 0;
  if (needs.includes("rest") || needs.includes("shade") || needs.includes("lowCrowd")) {
    score += id === "comfortable" ? 2 : 0;
  }

  return Math.max(50, Math.min(97, Math.round(score)));
}

async function getRoute(
  profile: (typeof profiles)[number],
  origin: LatLng,
  destination: LatLng,
  needs: PreferenceId[],
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

  const response = await fetch(VALHALLA_ROUTE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": CLIENT_ID,
      "User-Agent": "MadinahShade/0.2 (+https://madinah-shade-platform.vercel.app)",
    },
    body: JSON.stringify({
      locations: [
        { lat: origin.lat, lon: origin.lon, type: "break" },
        { lat: destination.lat, lon: destination.lon, type: "break" },
      ],
      costing: "pedestrian",
      costing_options: { pedestrian: pedestrianOptions },
      units: "kilometers",
      language: "en-US",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => ({}))) as ValhallaResponse;

  if (!response.ok || !payload.trip?.legs?.[0]?.shape) {
    throw new Error(payload.error || `تعذر حساب ${profile.name}.`);
  }

  const leg = payload.trip.legs[0];
  const coordinates = decodePolyline6(leg.shape || "");
  const maneuvers: LiveManeuver[] = (leg.maneuvers || []).map((maneuver) => ({
    instruction: ArabicInstruction(maneuver),
    distanceMeters: Math.round((maneuver.length || 0) * 1000),
    timeSeconds: Math.round(maneuver.time || 0),
    beginShapeIndex: maneuver.begin_shape_index || 0,
    endShapeIndex: maneuver.end_shape_index || 0,
  }));

  const distanceMeters = Math.round((payload.trip.summary?.length || 0) * 1000);
  const durationMinutes = Math.max(1, Math.round((payload.trip.summary?.time || 0) / 60));

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
    source: "Valhalla + OpenStreetMap",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RouteRequestBody;
    const origin = body.origin;
    const destination = body.destination;
    const needs = Array.isArray(body.needs) ? body.needs : [];

    if (!validPoint(origin) || !validPoint(destination)) {
      return NextResponse.json({ error: "إحداثيات البداية أو الوجهة غير صالحة." }, { status: 400 });
    }

    const straightLine = haversineMeters(origin, destination);
    if (straightLine < 15) {
      return NextResponse.json({ error: "البداية والوجهة متقاربتان جدًا." }, { status: 400 });
    }
    if (straightLine > 30_000) {
      return NextResponse.json({ error: "هذه النسخة مخصصة لرحلات المشي حتى 30 كم." }, { status: 400 });
    }

    const routes: LiveRoute[] = [];
    const errors: string[] = [];

    for (const profile of profiles) {
      try {
        routes.push(await getRoute(profile, origin, destination, needs));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `تعذر حساب ${profile.name}.`);
      }
    }

    if (!routes.length) {
      return NextResponse.json(
        { error: errors[0] || "لم نجد مسار مشي متاحًا بين النقطتين." },
        { status: 502 },
      );
    }

    routes.sort((a, b) => {
      if (needs.includes("wheelchair") || needs.includes("senior")) return b.comfortScore - a.comfortScore;
      return a.id === "comfortable" ? -1 : b.id === "comfortable" ? 1 : a.durationMinutes - b.durationMinutes;
    });

    return NextResponse.json({
      routes,
      partial: routes.length < profiles.length,
      provider: "Valhalla/OpenStreetMap",
    });
  } catch {
    return NextResponse.json({ error: "تعذر قراءة طلب المسار." }, { status: 400 });
  }
}
