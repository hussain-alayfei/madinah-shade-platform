"use client";

import "leaflet/dist/leaflet.css";
import { Droplets, LocateFixed, Map as MapIcon, Satellite, ScanLine, Trees } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import { getBrowserLocation, haversineMeters, type LatLng, type LocationFix, type RouteMode } from "@/lib/maps";

const routeStyles: Record<RouteMode, { color: string; weight: number; opacity: number }> = {
  comfortable: { color: "#0f6b54", weight: 7, opacity: 0.95 },
  balanced: { color: "#6c7d61", weight: 5, opacity: 0.74 },
  fastest: { color: "#ad7a3c", weight: 5, opacity: 0.74 },
  heritage: { color: "#7f6a4e", weight: 5, opacity: 0.68 },
};

const demoServices = [
  { id: "water-1", position: [24.4697, 39.61225] as LatLng, type: "مياه", label: "نقطة مياه تجريبية" },
  { id: "rest-1", position: [24.4689, 39.61405] as LatLng, type: "استراحة", label: "منطقة استراحة تجريبية" },
  { id: "water-2", position: [24.46825, 39.61535] as LatLng, type: "مياه", label: "نقطة مياه تجريبية" },
];

const MEDINA_CENTER: LatLng = [24.4695, 39.6134];
type ViewAction = { id: number; type: "center" | "fit" };
type BaseLayer = "street" | "satellite";

export type MapClientProps = {
  selected?: string;
  showAll?: boolean;
  routes?: Partial<Record<RouteMode, LatLng[]>>;
  start?: LatLng | null;
  end?: LatLng | null;
  trackUser?: boolean;
  onLocationChange?: (fix: LocationFix) => void;
  onLocationError?: (message: string) => void;
};

function ViewportController({ selectedPositions, start, end, current, action, followUser }: {
  selectedPositions: LatLng[];
  start?: LatLng | null;
  end?: LatLng | null;
  current: LocationFix | null;
  action: ViewAction;
  followUser: boolean;
}) {
  const map = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (selectedPositions.length > 1) map.fitBounds(selectedPositions, { padding: [48, 48] });
    else if (start && end) map.fitBounds([start, end], { padding: [48, 48] });
    else if (start) map.setView(start, 16);
  }, [end, map, selectedPositions, start]);
  useEffect(() => {
    if (action.type === "fit") {
      if (selectedPositions.length > 1) map.fitBounds(selectedPositions, { padding: [52, 52] });
      else if (start && end) map.fitBounds([start, end], { padding: [52, 52] });
      return;
    }
    const target: LatLng = current ? [current.lat, current.lon] : start || MEDINA_CENTER;
    map.setView(target, current ? 17 : 16);
  }, [action, current, end, map, selectedPositions, start]);
  useEffect(() => {
    if (!followUser || !current) return;
    map.panTo([current.lat, current.lon], { animate: true, duration: 0.35 });
  }, [current, followUser, map]);
  return null;
}

function locationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "تم رفض إذن الموقع. فعّله من إعدادات المتصفح لاستخدام التتبع.";
  if (error.code === error.TIMEOUT) return "انتهت مهلة GPS. حاول مرة أخرى في مكان مفتوح.";
  return "تعذر قراءة موقع الجهاز الحالي.";
}

export function MapClient({ selected = "comfortable", showAll = true, routes = {}, start = null, end = null, trackUser = false, onLocationChange, onLocationError }: MapClientProps) {
  const [showServices, setShowServices] = useState(false);
  const [showShade, setShowShade] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("street");
  const [viewAction, setViewAction] = useState<ViewAction>({ id: 0, type: "center" });
  const [current, setCurrent] = useState<LocationFix | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [followUser, setFollowUser] = useState(trackUser);
  const locationCallback = useRef(onLocationChange);
  const errorCallback = useRef(onLocationError);
  useEffect(() => { locationCallback.current = onLocationChange; }, [onLocationChange]);
  useEffect(() => { errorCallback.current = onLocationError; }, [onLocationError]);

  useEffect(() => {
    if (!trackUser || typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: LocationFix = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
          timestamp: position.timestamp,
        };
        setCurrent(fix);
        setLocationMessage("");
        locationCallback.current?.(fix);
      },
      (error) => {
        const message = locationErrorMessage(error);
        setLocationMessage(message);
        errorCallback.current?.(message);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackUser]);

  const typedSelected = selected as RouteMode;
  const selectedPositions = routes[typedSelected] || [];
  const entries = (Object.entries(routes) as [RouteMode, LatLng[]][]).filter(([, points]) => points?.length > 1);
  const nearMedina = useMemo(() => {
    const reference = start || selectedPositions[0];
    return reference ? haversineMeters(reference, MEDINA_CENTER) < 12000 : true;
  }, [selectedPositions, start]);
  const shadedSection = selectedPositions.slice(0, Math.max(2, Math.ceil(selectedPositions.length * 0.65)));

  function runViewAction(type: ViewAction["type"]) {
    if (type === "center" && current) setFollowUser(true);
    setViewAction((value) => ({ id: value.id + 1, type }));
  }

  async function locateOnce() {
    setLocationMessage("جاري قراءة GPS…");
    try {
      const fix = await getBrowserLocation();
      setCurrent(fix);
      setFollowUser(true);
      setLocationMessage(`دقة GPS تقريبًا ±${Math.round(fix.accuracy)} م`);
      locationCallback.current?.(fix);
      setViewAction((value) => ({ id: value.id + 1, type: "center" }));
    } catch (error) {
      const message = (error as Error).message;
      setLocationMessage(message);
      errorCallback.current?.(message);
    }
  }

  return (
    <>
      <MapContainer center={start || MEDINA_CENTER} zoom={16} scrollWheelZoom zoomControl={false} className="route-map" attributionControl>
        {baseLayer === "street" ? (
          <TileLayer key="osm-street" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        ) : (
          <TileLayer key="esri-satellite" attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        )}
        <ZoomControl position="bottomleft" />
        <ViewportController selectedPositions={selectedPositions} start={start} end={end} current={current} action={viewAction} followUser={followUser && trackUser} />
        {showShade && shadedSection.length > 1 && <Polyline positions={shadedSection} pathOptions={{ color: "#3f8b70", weight: 18, opacity: 0.16, lineCap: "round" }} />}
        {entries.map(([id, positions]) => {
          if (!showAll && id !== typedSelected) return null;
          const style = routeStyles[id] || routeStyles.comfortable;
          const active = id === typedSelected;
          return <Polyline key={id} positions={positions} pathOptions={{ color: style.color, weight: active ? style.weight + 2 : style.weight, opacity: active ? 1 : style.opacity, dashArray: active ? undefined : "8 10" }} />;
        })}
        {showServices && nearMedina && demoServices.map((service) => (
          <CircleMarker key={service.id} center={service.position} radius={6} pathOptions={{ color: "#ffffff", fillColor: service.type === "مياه" ? "#347f88" : "#8f6b3f", fillOpacity: 1, weight: 2 }}>
            <Popup><strong>{service.label}</strong><br />هذه النقطة توضيحية وليست خدمة حية.</Popup>
          </CircleMarker>
        ))}
        {start && <CircleMarker center={start} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}><Popup>نقطة البداية</Popup></CircleMarker>}
        {end && <CircleMarker center={end} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#183d35", fillOpacity: 1, weight: 3 }}><Popup>الوجهة</Popup></CircleMarker>}
        {current && <><Circle center={[current.lat, current.lon]} radius={Math.max(8, current.accuracy)} pathOptions={{ color: "#2876a8", fillColor: "#2876a8", fillOpacity: 0.08, weight: 1 }} /><CircleMarker center={[current.lat, current.lon]} radius={8} pathOptions={{ color: "#ffffff", fillColor: "#2876a8", fillOpacity: 1, weight: 3 }}><Popup>موقعك الحالي · ±{Math.round(current.accuracy)} م</Popup></CircleMarker></>}
      </MapContainer>
      <div className="map-tools" aria-label="أدوات الخريطة">
        <button type="button" onClick={locateOnce} className={current ? "is-active" : ""} title="تحديد موقعي الحقيقي"><LocateFixed size={15} /><span>موقعي</span></button>
        <button type="button" onClick={() => runViewAction("fit")} disabled={!selectedPositions.length && !(start && end)} title="إظهار المسار كاملًا"><ScanLine size={15} /><span>المسار</span></button>
        <button type="button" className={baseLayer === "street" ? "is-active" : ""} onClick={() => setBaseLayer("street")}><MapIcon size={15} /><span>شوارع</span></button>
        <button type="button" className={baseLayer === "satellite" ? "is-active" : ""} onClick={() => setBaseLayer("satellite")}><Satellite size={15} /><span>قمر صناعي</span></button>
        <button type="button" className={showShade ? "is-active" : ""} onClick={() => setShowShade((value) => !value)} disabled={!selectedPositions.length}><Trees size={15} /><span>ظل تجريبي</span></button>
        <button type="button" className={showServices ? "is-active" : ""} onClick={() => setShowServices((value) => !value)} disabled={!nearMedina}><Droplets size={15} /><span>خدمات تجريبية</span></button>
      </div>
      {locationMessage && <div className="map-location-status" role="status">{locationMessage}</div>}
      <div className="map-legend" aria-label="مفتاح الخريطة">
        {selectedPositions.length > 1 && <span><i className="route" /> مسار OSM فعلي</span>}
        {current && <span><i className="gps" /> GPS</span>}
        {showShade && <span><i className="shade" /> ظل تقديري</span>}
        {showServices && <span><i className="service" /> خدمات توضيحية</span>}
      </div>
    </>
  );
}
