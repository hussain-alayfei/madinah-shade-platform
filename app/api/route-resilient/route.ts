import { NextRequest, NextResponse } from "next/server";
import type { LatLng } from "@/lib/maps";

type RouteBody = {
  origin?: LatLng;
  destination?: LatLng;
  needs?: string[];
};

type RoutePayload = {
  routes?: unknown[];
  error?: string;
  code?: string;
  [key: string]: unknown;
};

function offsetPoint(point: LatLng, northMeters: number, eastMeters: number): LatLng {
  const metersPerLat = 111_320;
  const metersPerLon = 111_320 * Math.cos((point.lat * Math.PI) / 180);
  return {
    lat: point.lat + northMeters / metersPerLat,
    lon: point.lon + eastMeters / Math.max(1, metersPerLon),
  };
}

function ring(point: LatLng, meters: number) {
  const diagonal = meters / Math.SQRT2;
  return [
    offsetPoint(point, meters, 0),
    offsetPoint(point, -meters, 0),
    offsetPoint(point, 0, meters),
    offsetPoint(point, 0, -meters),
    offsetPoint(point, diagonal, diagonal),
    offsetPoint(point, diagonal, -diagonal),
    offsetPoint(point, -diagonal, diagonal),
    offsetPoint(point, -diagonal, -diagonal),
  ];
}

async function callRouter(baseUrl: string, body: RouteBody) {
  const response = await fetch(`${baseUrl}/api/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(18_000),
  });
  const payload = (await response.json().catch(() => ({}))) as RoutePayload;
  return { response, payload };
}

async function firstSuccessful(baseUrl: string, bodies: RouteBody[]) {
  const attempts = bodies.map(async (body) => {
    const result = await callRouter(baseUrl, body);
    if (!result.response.ok || !result.payload.routes?.length) throw new Error("no-route");
    return result;
  });

  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RouteBody | null;
  if (!body?.origin || !body?.destination) {
    return NextResponse.json({ error: "تعذر قراءة نقطة البداية أو الوجهة." }, { status: 400 });
  }

  const baseUrl = request.nextUrl.origin;
  const direct = await callRouter(baseUrl, body);
  if (direct.response.ok && direct.payload.routes?.length) {
    return NextResponse.json(direct.payload, { status: direct.response.status });
  }

  // Some geocoders return the center of a mosque, plaza or large building rather than a
  // walkable entrance. Retry around the selected point while keeping the user's labels intact.
  for (const radius of [45, 90, 140]) {
    const originCandidates = ring(body.origin, radius);
    const destinationCandidates = ring(body.destination, radius);
    const candidates: RouteBody[] = [];

    // Prefer moving only one endpoint, then try paired offsets if both points need snapping.
    for (const destination of destinationCandidates) candidates.push({ ...body, destination });
    for (const origin of originCandidates) candidates.push({ ...body, origin });
    for (let index = 0; index < 8; index += 1) {
      candidates.push({ ...body, origin: originCandidates[index], destination: destinationCandidates[index] });
      candidates.push({ ...body, origin: originCandidates[index], destination: destinationCandidates[(index + 4) % 8] });
    }

    const recovered = await firstSuccessful(baseUrl, candidates);
    if (recovered) {
      return NextResponse.json(
        { ...recovered.payload, snappedToWalkableNetwork: true },
        { status: recovered.response.status },
      );
    }
  }

  return NextResponse.json(
    {
      error: "ما قدرنا نلقى مدخل مشي متصل لهالمكانين الآن. جرّب نقطة قريبة من المدخل.",
      code: direct.payload.code || "ROUTING_UNAVAILABLE",
    },
    { status: direct.response.status >= 400 ? direct.response.status : 502 },
  );
}
