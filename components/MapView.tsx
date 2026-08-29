"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./MapClient").then((mod) => mod.MapClient), {
  ssr: false,
  loading: () => <div className="map-loading">جاري تحميل الخريطة…</div>,
});

export function MapView({ selected = "comfortable", showAll = true }: { selected?: string; showAll?: boolean }) {
  return <MapClient selected={selected} showAll={showAll} />;
}
