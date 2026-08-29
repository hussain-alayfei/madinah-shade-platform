import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_ID = "MadinahShade/0.2 (+https://github.com/hussain-alayfei/madinah-shade-platform)";

function headers() {
  return {
    "User-Agent": APP_ID,
    "Accept-Language": "ar,en;q=0.8",
    Accept: "application/json",
  };
}

function parseCoordinate(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const lat = parseCoordinate(params.get("lat"));
  const lon = parseCoordinate(params.get("lon"));

  try {
    if (lat !== null && lon !== null) {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("zoom", "18");
      url.searchParams.set("addressdetails", "1");
      const response = await fetch(url, {
        headers: headers(),
        signal: AbortSignal.timeout(9000),
        next: { revalidate: 86400 },
      });
      if (!response.ok) {
        return NextResponse.json({ error: "تعذر تحديد اسم الموقع الحالي." }, { status: 502 });
      }
      const result = await response.json();
      return NextResponse.json({
        result: {
          label: result.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          lat,
          lon,
        },
      });
    }

    if (!q || q.length < 2) {
      return NextResponse.json({ error: "اكتب اسم موقع صالح للبحث." }, { status: 400 });
    }

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "sa");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("viewbox", "39.30,24.75,40.05,24.10");
    url.searchParams.set("bounded", "0");

    const response = await fetch(url, {
      headers: headers(),
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "تعذر الوصول إلى خدمة البحث عن الأماكن." }, { status: 502 });
    }

    const data = await response.json();
    const results = Array.isArray(data)
      ? data
          .map((item) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
          }))
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
      : [];

    if (!results.length) {
      return NextResponse.json({ error: "لم نعثر على هذا المكان داخل السعودية." }, { status: 404 });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Geocoding failed", error);
    return NextResponse.json({ error: "حدث خطأ أثناء البحث عن الموقع." }, { status: 500 });
  }
}
