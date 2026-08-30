"use client";

import "leaflet/dist/leaflet.css";
import { Layers3, LocateFixed, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { LatLng, LiveRoute, UserPosition } from "@/lib/maps";

const MEDINA_CENTER: [number, number] = [24.4672, 39.6112];
const routeStyles: Record<string, { color: string; weight: number }> = { comfortable: { color: "#0f6b54", weight: 8 }, balanced: { color: "#68796f", weight: 6 }, fastest: { color: "#ad7a3c", weight: 6 } };
type ViewAction = { id: number; type: "center" | "fit" };
type Props = { routes?: LiveRoute[]; selected?: string; showAll?: boolean; origin?: LatLng; destination?: LatLng; userPosition?: UserPosition; followUser?: boolean };

function ViewportController({ selectedRoute, action, origin, userPosition, followUser }: { selectedRoute?: LiveRoute; action: ViewAction; origin?: LatLng; userPosition?: UserPosition; followUser?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (action.type === "fit" && selectedRoute?.coordinates.length) { map.fitBounds(selectedRoute.coordinates, { padding: [48, 48], maxZoom: 18 }); return; }
    const target = userPosition || origin;
    if (target) map.setView([target.lat, target.lon], Math.max(map.getZoom(), 16)); else map.setView(MEDINA_CENTER, 15);
  }, [action, map, origin, selectedRoute, userPosition]);
  useEffect(() => { if (followUser && userPosition) map.panTo([userPosition.lat, userPosition.lon], { animate: true, duration: 0.5 }); }, [followUser, map, userPosition]);
  return null;
}

export function MapClient({ routes = [], selected, showAll = true, origin, destination, userPosition, followUser = false }: Props) {
  const [baseLayer, setBaseLayer] = useState<"street" | "satellite">("street");
  const [viewAction, setViewAction] = useState<ViewAction>({ id: 0, type: routes.length ? "fit" : "center" });
  const selectedRoute = useMemo(() => routes.find((route) => route.id === selected) || routes[0], [routes, selected]);
  useEffect(() => { if (selectedRoute?.coordinates.length) setViewAction((current) => ({ id: current.id + 1, type: "fit" })); }, [selectedRoute?.id, selectedRoute?.coordinates.length]);
  function runViewAction(type: ViewAction["type"]) { setViewAction((current) => ({ id: current.id + 1, type })); }
  const initialCenter: [number, number] = userPosition ? [userPosition.lat, userPosition.lon] : origin ? [origin.lat, origin.lon] : MEDINA_CENTER;

  return <>
    <MapContainer center={initialCenter} zoom={routes.length ? 16 : 15} scrollWheelZoom zoomControl={false} className="route-map" attributionControl>
      {baseLayer === "street" ? <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} /> : <TileLayer attribution='EOxCloudless © <a href="https://cloudless.eox.at">EOX</a> · modified Copernicus Sentinel data 2025' url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg" maxNativeZoom={14} maxZoom={19} />}
      <ZoomControl position="bottomleft" />
      <ViewportController selectedRoute={selectedRoute} action={viewAction} origin={origin} userPosition={userPosition} followUser={followUser} />
      {routes.map((route) => { if (!showAll && route.id !== selectedRoute?.id) return null; const active = route.id === selectedRoute?.id; const style = routeStyles[route.id] || routeStyles.balanced; return <Polyline key={route.id} positions={route.coordinates} pathOptions={{ color: style.color, weight: active ? style.weight + 2 : style.weight, opacity: active ? 0.98 : 0.48, dashArray: active ? undefined : "8 10", lineCap: "round" }} />; })}
      {origin && <CircleMarker center={[origin.lat, origin.lon]} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}><Popup>نقطة البداية</Popup></CircleMarker>}
      {destination && <CircleMarker center={[destination.lat, destination.lon]} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#183d35", fillOpacity: 1, weight: 3 }}><Popup>الوجهة</Popup></CircleMarker>}
      {userPosition && <>{userPosition.accuracy && <Circle center={[userPosition.lat, userPosition.lon]} radius={Math.max(8, userPosition.accuracy)} pathOptions={{ color: "#1472a3", fillColor: "#1472a3", fillOpacity: 0.08, weight: 1 }} />}<CircleMarker center={[userPosition.lat, userPosition.lon]} radius={9} pathOptions={{ color: "#ffffff", fillColor: "#1472a3", fillOpacity: 1, weight: 3 }}><Popup>موقعك الحالي</Popup></CircleMarker></>}
    </MapContainer>
    <div className="map-tools" aria-label="أدوات الخريطة"><button type="button" onClick={() => runViewAction("center")} title={userPosition ? "العودة إلى موقعي" : "إعادة التوسيط"}><LocateFixed size={15} /><span>{userPosition ? "موقعي" : "توسيط"}</span></button>{selectedRoute && <button type="button" onClick={() => runViewAction("fit")} title="إظهار المسار كاملًا"><ScanLine size={15} /><span>المسار</span></button>}<button type="button" className={baseLayer === "satellite" ? "is-active" : ""} onClick={() => setBaseLayer((current) => current === "street" ? "satellite" : "street")} title="تبديل الخريطة الأساسية"><Layers3 size={15} /><span>{baseLayer === "street" ? "قمر صناعي" : "شوارع"}</span></button></div>
    <div className="map-legend" aria-label="مفتاح الخريطة">{selectedRoute && <span><i className="route" /> المسار المحدد</span>}{userPosition && <span><i className="gps" /> موقعك الحي</span>}<span>{baseLayer === "satellite" ? "Sentinel‑2 2025" : "OpenStreetMap"}</span></div>
  </>;
}
