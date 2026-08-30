import { NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const APP_USER_AGENT = "MadinahShade/0.2 (+https://madinah-shade-platform.vercel.app)";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "اكتب اسم موقع أو وجهة واضحة." }, { status: 400 });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "sa");
  url.searchParams.set("accept-language", "ar,en");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": APP_USER_AGENT,
        "Accept-Language": "ar,en;q=0.8",
      },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "خدمة البحث عن الأماكن غير متاحة مؤقتًا." }, { status: 502 });
    }

    const data = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      name?: string;
      type?: string;
    }>;

    const results = data
      .map((item) => ({
        label: item.name || item.display_name.split(",")[0] || item.display_name,
        fullLabel: item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon),
        type: item.type || "place",
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

    if (!results.length) {
      return NextResponse.json({ results: [], error: "لم نجد هذا المكان داخل السعودية." }, { status: 404 });
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "تعذر الاتصال بخدمة البحث عن الأماكن." }, { status: 502 });
  }
}
