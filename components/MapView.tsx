"use client";

import dynamic from "next/dynamic";
import type { LatLng, LiveRoute, UserPosition } from "@/lib/maps";

const MapClient = dynamic(() => import("./MapClient").then((mod) => mod.MapClient), {
  ssr: false,
  loading: () => <div className="map-loading">جاري تحميل الخريطة…</div>,
});

export type MapViewProps = {
  routes?: LiveRoute[];
  selected?: string;
  showAll?: boolean;
  origin?: LatLng;
  destination?: LatLng;
  userPosition?: UserPosition;
  followUser?: boolean;
  onSelectRoute?: (routeId: LiveRoute["id"]) => void;
};

export function MapView(props: MapViewProps) {
  return <MapClient {...props} />;
}
