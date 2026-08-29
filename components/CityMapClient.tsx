"use client";

import "leaflet/dist/leaflet.css";
import { Map as MapIcon, Satellite } from "lucide-react";
import { useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

const hotspots = [
  { center: [24.4706, 39.6121] as [number, number], radius: 95, label: "تعرض حراري مرتفع", type: "heat", typeLabel: "حرارة", color: "#9b6b27" },
  { center: [24.4693, 39.6146] as [number, number], radius: 80, label: "كثافة مشاة مرتفعة", type: "crowd", typeLabel: "ازدحام", color: "#a54536" },
  { center: [24.4682, 39.6118] as [number, number], radius: 65, label: "ملاحظة إتاحة متكررة", type: "accessibility", typeLabel: "إتاحة", color: "#8f6b3f" },
  { center: [24.4715, 39.6151] as [number, number], radius: 60, label: "نقص خدمات على المسار", type: "services", typeLabel: "خدمات", color: "#506a61" },
];

export function CityMapClient({ focus = "overview" }: { focus?: string }) {
  const [baseLayer, setBaseLayer] = useState<"street" | "satellite">("street");
  const relevant = ["heat", "crowd", "accessibility", "services"].includes(focus) ? hotspots.filter((spot) => spot.type === focus) : hotspots;
  return <>
    <MapContainer center={[24.4696, 39.6135]} zoom={16} scrollWheelZoom className="route-map">
      {baseLayer === "street" ? <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} /> : <TileLayer attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />}
      {relevant.map((spot) => <Circle key={spot.label} center={spot.center} radius={spot.radius} pathOptions={{ color: spot.color, fillColor: spot.color, fillOpacity: 0.16, weight: 2 }}><Popup><strong>{spot.typeLabel}</strong><br />{spot.label}<br /><small>بيانات لوحة المدينة هنا توضيحية وليست تغذية حية.</small></Popup></Circle>)}
      <CircleMarker center={[24.46775, 39.61645]} radius={7} pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}><Popup>نقطة مرجعية</Popup></CircleMarker>
    </MapContainer>
    <div className="city-map-switch" aria-label="نوع خريطة لوحة المدينة"><button type="button" className={baseLayer === "street" ? "is-active" : ""} onClick={() => setBaseLayer("street")}><MapIcon size={14} /> شوارع</button><button type="button" className={baseLayer === "satellite" ? "is-active" : ""} onClick={() => setBaseLayer("satellite")}><Satellite size={14} /> قمر صناعي</button></div>
  </>;
}
