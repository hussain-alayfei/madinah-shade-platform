import { NextRequest, NextResponse } from "next/server";
import type { LatLng, LiveRoute, RouteMode } from "@/lib/maps";

export const dynamic = "force-dynamic";

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const CLIENT_ID = "madinah-shade-platform.vercel.app";
const HERITAGE_POINT: LatLng = [24.470239, 39.606839];
const ALLOWED_MODES: RouteMode[] = ["comfortable", "balanced", "fastest", "heritage"];

function validPoint(value: unknown): value is LatLng {
  return Array.isArray(value) && value.length === 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) && Math.abs(Number(value[0])) <= 90 && Math.abs(Number(value[1])) <= 180;
}

function parseCoordinate(value: string | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function distanceMeters(a: LatLng, b: LatLng) {
  const earth = 6371000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function arabicInstruction(step: any) {
  const maneuver = step?.maneuver || {};
  const type = String(maneuver.type || "");
  const modifier = String(maneuver.modifier || "");
  const road = String(step?.name || "").trim();
  const onto = road ? ` إلى ${road}` : "";
  if (type === "arrive") return "وصلت إلى وجهتك";
  if (type === "depart") return road ? `ابدأ باتجاه ${road}` : "ابدأ المشي على المسار";
  if (type === "roundabout" || type === "rotary") return road ? `ادخل الدوار ثم تابع نحو ${road}` : "ادخل الدوار وتابع حسب المسار";
  if (type === "continue" || type === "new name") return road ? `استمر على ${road}` : "استمر للأمام";
  if (type === "merge") return road ? `اندمج نحو ${road}` : "تابع مع الممر";
  if (type === "fork") {
    if (modifier.includes("left")) return `خذ المسار الأيسر${onto}`;
    if (modifier.includes("right")) return `خذ المسار الأيمن${onto}`;
    return `تابع عند التفرع${onto}`;
  }
  if (type === "turn" || type === "end of road") {
    if (modifier.includes("left")) return `اتجه يسارًا${onto}`;
    if (modifier.includes("right")) return `اتجه يمينًا${onto}`;
    if (modifier.includes("uturn")) return `استدر للخلف${onto}`;
    return `انعطف${onto}`;
  }
  if (modifier.includes("left")) return `اتجه يسارًا${onto}`;
  if (modifier.includes("right")) return `اتجه يمينًا${onto}`;
  if (modifier.includes("straight")) return road ? `استمر للأمام على ${road}` : "استمر للأمام";
  return road ? `تابع على ${road}` : "تابع على المسار";
}

function pedestrianOptions(mode: RouteMode, needs: string[]) {
  const wheelchair = needs.includes("wheelchair");
  const senior = needs.includes("senior");
  const accessibilityHeavy = wheelchair || senior;
  const base: Record<string, string | number | boolean> = {
    type: wheelchair ? "wheelchair" : "foot",
    walking_speed: senior ? 3.8 : 4.8,
    use_hills: accessibilityHeavy ? 0.05 : mode === "comfortable" ? 0.2 : 0.45,
    walkway_factor: mode === "comfortable" ? 0.55 : mode === "balanced" ? 0.8 : 1,
    sidewalk_factor: mode === "comfortable" ? 0.5 : mode === "balanced" ? 0.8 : 1,
    alley_factor: mode === "comfortable" ? 4 : 2,
    driveway_factor: mode === "comfortable" ? 8 : 5,
    step_penalty: accessibilityHeavy ? 43200 : mode === "comfortable" ? 900 : 30,
    use_living_streets: mode === "comfortable" ? 0.9 : 0.6,
    use_tracks: mode === "comfortable" ? 0.2 : 0.5,
    max_hiking_difficulty: 1,
  };
  if (mode === "fastest") base.shortest = true;
  return base;
}

function normalizeRoute(data: any, mode: RouteMode, viaLabel?: string | null): LiveRoute {
  const route = data?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!route || !Array.isArray(coordinates)) throw new Error("No route geometry returned");
  const geometry: LatLng[] = coordinates.map((point: [number, number]) => [Number(point[1]), Number(point[0])] as LatLng).filter((point: LatLng) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  const maneuvers = (route.legs || []).flatMap((leg: any) => leg.steps || []).map((step: any) => ({
    instruction: arabicInstruction(step),
    distanceMeters: Math.max(0, Number(step.distance) || 0),
    durationSeconds: Math.max(0, Number(step.duration) || 0),
    type: String(step?.maneuver?.type || "continue"),
    modifier: step?.maneuver?.modifier ? String(step.maneuver.modifier) : null,
  })).filter((step: any) => step.instruction);
  return { id: mode, distanceMeters: Math.max(0, Number(route.distance) || 0), durationSeconds: Math.max(0, Number(route.duration) || 0), geometry, maneuvers, viaLabel: viaLabel || null, source: "valhalla" };
}

async function calculateRoute(start: LatLng, end: LatLng, mode: RouteMode, needs: string[]) {
  const locations: any[] = [{ lat: start[0], lon: start[1], type: "break" }];
  let viaLabel: string | null = null;
  const heritageNearby = distanceMeters(start, HERITAGE_POINT) < 8000 && distanceMeters(end, HERITAGE_POINT) < 8000;
  if (mode === "heritage" && heritageNearby) {
    locations.push({ lat: HERITAGE_POINT[0], lon: HERITAGE_POINT[1], type: "through", name: "سقيفة بني ساعدة" });
    viaLabel = "سقيفة بني ساعدة";
  }
  locations.push({ lat: end[0], lon: end[1], type: "break" });
  const payload = {
    locations,
    costing: "pedestrian",
    costing_options: { pedestrian: pedestrianOptions(mode, needs) },
    units: "kilometers",
    format: "osrm",
    shape_format: "geojson",
    banner_instructions: true,
    voice_instructions: true,
    directions_type: "instructions",
  };
  const response = await fetch(VALHALLA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": CLIENT_ID,
      "User-Agent": "MadinahShade/0.3 (+https://github.com/hussain-alayfei/madinah-shade-platform)",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Valhalla error", response.status, data);
    const message = data?.error || data?.error_code || data?.status_message;
    const error = new Error(message ? `تعذر حساب المسار: ${message}` : "تعذر حساب مسار المشي الآن.");
    (error as any).status = response.status === 429 ? 503 : 502;
    throw error;
  }
  return normalizeRoute(data, mode, viaLabel);
}

function validateRequest(start: unknown, end: unknown, mode: unknown) {
  if (!validPoint(start) || !validPoint(end)) return "إحداثيات البداية أو الوجهة غير صالحة.";
  if (!ALLOWED_MODES.includes(mode as RouteMode)) return "نوع المسار غير معروف.";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const start = body?.start as unknown;
    const end = body?.end as unknown;
    const mode = body?.mode as RouteMode;
    const needs = Array.isArray(body?.needs) ? body.needs.map(String) : [];
    const validation = validateRequest(start, end, mode);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
    const route = await calculateRoute(start as LatLng, end as LatLng, mode, needs);
    return NextResponse.json({ route });
  } catch (error) {
    console.error("Route calculation failed", error);
    const status = Number((error as any)?.status) || 500;
    return NextResponse.json({ error: (error as Error)?.message || "حدث خطأ أثناء حساب مسار المشي." }, { status });
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fromLat = parseCoordinate(params.get("fromLat"));
  const fromLon = parseCoordinate(params.get("fromLon"));
  const toLat = parseCoordinate(params.get("toLat"));
  const toLon = parseCoordinate(params.get("toLon"));
  const mode = (params.get("mode") || "comfortable") as RouteMode;
  const needs = (params.get("needs") || "").split(",").filter(Boolean);
  const start: LatLng | null = fromLat !== null && fromLon !== null ? [fromLat, fromLon] : null;
  const end: LatLng | null = toLat !== null && toLon !== null ? [toLat, toLon] : null;
  const validation = validateRequest(start, end, mode);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  try {
    const route = await calculateRoute(start as LatLng, end as LatLng, mode, needs);
    return NextResponse.json({ route });
  } catch (error) {
    console.error("Route health check failed", error);
    const status = Number((error as any)?.status) || 500;
    return NextResponse.json({ error: (error as Error)?.message || "حدث خطأ أثناء حساب مسار المشي." }, { status });
  }
}
