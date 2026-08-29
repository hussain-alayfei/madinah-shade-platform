"use client";

import dynamic from "next/dynamic";
import type { LatLng, LocationFix, RouteMode } from "@/lib/maps";
import type { MapClientProps } from "./MapClient";

const MapClient = dynamic(() => import("./MapClient").then((mod) => mod.MapClient), {
  ssr: false,
  loading: () => <div className="map-loading">جاري تحميل الخريطة…</div>,
});

export type MapViewProps = {
  selected?: string;
  showAll?: boolean;
  routes?: Partial<Record<RouteMode, LatLng[]>>;
  start?: LatLng | null;
  end?: LatLng | null;
  trackUser?: boolean;
  onLocationChange?: (fix: LocationFix) => void;
  onLocationError?: (message: string) => void;
};

export function MapView(props: MapViewProps) {
  return <MapClient {...(props as MapClientProps)} />;
}
