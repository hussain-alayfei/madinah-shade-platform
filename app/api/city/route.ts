import { NextResponse } from "next/server";
import {
  buildCityDashboardSnapshot,
  isCityLayer,
  isCityPeriod,
  type CityLayerId,
  type CityPeriod,
} from "@/lib/city-dashboard";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period");
  const layerParam = searchParams.get("layer");

  const period: CityPeriod = isCityPeriod(periodParam) ? periodParam : "today";
  const layer: CityLayerId = isCityLayer(layerParam) ? layerParam : "overview";

  // Today this adapter returns deterministic demo data. When the operational
  // database is ready, replace this call with the database-backed repository;
  // the page contract can stay unchanged.
  const snapshot = buildCityDashboardSnapshot(period, layer);

  return NextResponse.json({ snapshot });
}
