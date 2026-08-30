"use client";

import dynamic from "next/dynamic";
import type { CitySignal } from "@/lib/city-dashboard";

const CityMapClient = dynamic(() => import("./CityMapClient").then((mod) => mod.CityMapClient), {
  ssr: false,
  loading: () => <div className="map-loading">جاري تحميل بيانات المدينة…</div>,
});

export function CityMapView({
  signals,
  selectedId,
  onSelect,
}: {
  signals: CitySignal[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  return <CityMapClient signals={signals} selectedId={selectedId} onSelect={onSelect} />;
}
