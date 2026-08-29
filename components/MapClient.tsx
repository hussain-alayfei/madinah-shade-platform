"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, ZoomControl } from "react-leaflet";
import { medinaRoutes } from "@/lib/data";

const routeStyles: Record<string, { color: string; weight: number; opacity: number }> = {
  comfortable: { color: "#0f6b54", weight: 7, opacity: 0.95 },
  balanced: { color: "#6c7d61", weight: 5, opacity: 0.72 },
  fastest: { color: "#ad7a3c", weight: 5, opacity: 0.72 },
  heritage: { color: "#7f6a4e", weight: 5, opacity: 0.65 },
};

export function MapClient({ selected = "comfortable", showAll = true }: { selected?: string; showAll?: boolean }) {
  const start: [number, number] = [24.47085, 39.61015];
  const end: [number, number] = [24.46775, 39.61645];

  return (
    <MapContainer
      center={[24.4695, 39.6134]}
      zoom={16}
      scrollWheelZoom
      zoomControl={false}
      className="route-map"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomleft" />

      {Object.entries(medinaRoutes).map(([id, positions]) => {
        if (!showAll && id !== selected) return null;
        const style = routeStyles[id];
        const active = id === selected;
        return (
          <Polyline
            key={id}
            positions={positions}
            pathOptions={{
              color: style.color,
              weight: active ? style.weight + 2 : style.weight,
              opacity: active ? 1 : style.opacity,
              dashArray: active ? undefined : "8 10",
            }}
          />
        );
      })}

      <CircleMarker center={start} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}>
        <Popup>نقطة البداية</Popup>
      </CircleMarker>
      <CircleMarker center={end} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#183d35", fillOpacity: 1, weight: 3 }}>
        <Popup>الوجهة</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
