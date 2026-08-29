"use client";

import "leaflet/dist/leaflet.css";
import { Droplets, LocateFixed, ScanLine, Trees } from "lucide-react";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import { medinaRoutes } from "@/lib/data";

const routeStyles: Record<string, { color: string; weight: number; opacity: number }> = {
  comfortable: { color: "#0f6b54", weight: 7, opacity: 0.95 },
  balanced: { color: "#6c7d61", weight: 5, opacity: 0.72 },
  fastest: { color: "#ad7a3c", weight: 5, opacity: 0.72 },
  heritage: { color: "#7f6a4e", weight: 5, opacity: 0.65 },
};

const services = [
  { id: "water-1", position: [24.4697, 39.61225] as [number, number], type: "مياه", label: "نقطة مياه" },
  { id: "rest-1", position: [24.4689, 39.61405] as [number, number], type: "استراحة", label: "منطقة استراحة" },
  { id: "water-2", position: [24.46825, 39.61535] as [number, number], type: "مياه", label: "نقطة مياه" },
];

type ViewAction = { id: number; type: "center" | "fit" };

function ViewportController({ selected, action }: { selected: string; action: ViewAction }) {
  const map = useMap();

  useEffect(() => {
    const positions = medinaRoutes[selected as keyof typeof medinaRoutes] ?? medinaRoutes.comfortable;
    if (action.type === "fit") {
      map.fitBounds(positions, { padding: [44, 44] });
    } else {
      map.setView([24.4695, 39.6134], 16);
    }
  }, [action, map, selected]);

  return null;
}

export function MapClient({ selected = "comfortable", showAll = true }: { selected?: string; showAll?: boolean }) {
  const start: [number, number] = [24.47085, 39.61015];
  const end: [number, number] = [24.46775, 39.61645];
  const selectedPositions = medinaRoutes[selected as keyof typeof medinaRoutes] ?? medinaRoutes.comfortable;
  const shadedSection = selectedPositions.slice(0, Math.max(2, Math.ceil(selectedPositions.length * 0.7)));
  const [showServices, setShowServices] = useState(true);
  const [showShade, setShowShade] = useState(true);
  const [viewAction, setViewAction] = useState<ViewAction>({ id: 0, type: "center" });

  function runViewAction(type: ViewAction["type"]) {
    setViewAction((current) => ({ id: current.id + 1, type }));
  }

  return (
    <>
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
        <ViewportController selected={selected} action={viewAction} />

        {showShade && (
          <Polyline
            positions={shadedSection}
            pathOptions={{ color: "#3f8b70", weight: 18, opacity: 0.16, lineCap: "round" }}
          />
        )}

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

        {showServices && services.map((service) => (
          <CircleMarker
            key={service.id}
            center={service.position}
            radius={6}
            pathOptions={{
              color: "#ffffff",
              fillColor: service.type === "مياه" ? "#347f88" : "#8f6b3f",
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Popup><strong>{service.label}</strong><br />بيانات تجريبية ضمن نطاق المسار.</Popup>
          </CircleMarker>
        ))}

        <CircleMarker center={start} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}>
          <Popup>نقطة البداية</Popup>
        </CircleMarker>
        <CircleMarker center={end} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#183d35", fillOpacity: 1, weight: 3 }}>
          <Popup>الوجهة</Popup>
        </CircleMarker>
      </MapContainer>

      <div className="map-tools" aria-label="أدوات الخريطة">
        <button type="button" onClick={() => runViewAction("center")} title="إعادة التوسيط">
          <LocateFixed size={15} /><span>توسيط</span>
        </button>
        <button type="button" onClick={() => runViewAction("fit")} title="إظهار المسار كاملًا">
          <ScanLine size={15} /><span>المسار</span>
        </button>
        <button type="button" className={showShade ? "is-active" : ""} onClick={() => setShowShade((value) => !value)}>
          <Trees size={15} /><span>الظل</span>
        </button>
        <button type="button" className={showServices ? "is-active" : ""} onClick={() => setShowServices((value) => !value)}>
          <Droplets size={15} /><span>الخدمات</span>
        </button>
      </div>

      <div className="map-legend" aria-label="مفتاح الخريطة">
        <span><i className="route" /> المسار المحدد</span>
        {showShade && <span><i className="shade" /> ظل تقديري</span>}
        {showServices && <span><i className="service" /> خدمات</span>}
      </div>
    </>
  );
}
