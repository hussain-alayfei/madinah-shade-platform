import { NextRequest } from "next/server";
import { POST as calculateRoute } from "../route/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const request = new NextRequest("https://madinah-shade.internal/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start: [24.47085, 39.61015],
      end: [24.4686804, 39.611162],
      mode: "comfortable",
      needs: [],
    }),
  });
  return calculateRoute(request);
}
