"use client";

import "leaflet/dist/leaflet.css";
import { Layers3, LocateFixed, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, ZoomControl } from "react-leaflet";
import type { LatLng, LiveRoute, UserPosition } from "@/lib/maps";

const MEDINA_CENTER: [number, number] = [24.4672, 39.6112];
const routeStyles: Record<string, { color: string; weight: number }> = {
  comfortable: { color: "#0f6b54", weight: 8 },
  balanced: { color: "#607d73", weight: 7 },
  fastest: { color: "#ad7a3c", weight: 7 },
};

type ViewAction = {
  id: number;
  type: "center" | "fit";
  target?: LatLng;
};

type Props = {
  routes?: LiveRoute[];
  selected?: string;
  showAll?: boolean;
  origin?: LatLng;
  destination?: LatLng;
  userPosition?: UserPosition;
  followUser?: boolean;
  onSelectRoute?: (routeId: LiveRoute["id"]) => void;
};

function ViewportController({
  selectedRoute,
  action,
  userPosition,
  followUser,
}: {
  selectedRoute?: LiveRoute;
  action: ViewAction;
  userPosition?: UserPosition;
  followUser?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (action.type === "fit" && selectedRoute?.coordinates.length) {
      map.fitBounds(selectedRoute.coordinates, { padding: [54, 54], maxZoom: 18, animate: true, duration: 0.28 });
      return;
    }

    if (action.target) {
      map.setView([action.target.lat, action.target.lon], Math.max(map.getZoom(), 16), { animate: true });
    }
  }, [action.id, action.type, action.target?.lat, action.target?.lon, map, selectedRoute]);

  useEffect(() => {
    if (followUser && userPosition) {
      map.panTo([userPosition.lat, userPosition.lon], { animate: true, duration: 0.35 });
    }
  }, [followUser, map, userPosition?.lat, userPosition?.lon]);

  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [map]);

  return null;
}

export function MapClient({
  routes = [],
  selected,
  showAll = true,
  origin,
  destination,
  userPosition,
  followUser = false,
  onSelectRoute,
}: Props) {
  const [baseLayer, setBaseLayer] = useState<"standard" | "aerial">("standard");
  const [viewAction, setViewAction] = useState<ViewAction>({
    id: 0,
    type: routes.length ? "fit" : "center",
    target: userPosition || origin || { lat: MEDINA_CENTER[0], lon: MEDINA_CENTER[1] },
  });
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selected) || routes[0],
    [routes, selected],
  );

  useEffect(() => {
    if (selectedRoute?.coordinates.length) {
      setViewAction((current) => ({ id: current.id + 1, type: "fit" }));
    }
  }, [selectedRoute?.id]);

  function runViewAction(type: ViewAction["type"]) {
    if (type === "center") {
      setViewAction((current) => ({
        id: current.id + 1,
        type,
        target: userPosition || origin || { lat: MEDINA_CENTER[0], lon: MEDINA_CENTER[1] },
      }));
      return;
    }

    setViewAction((current) => ({ id: current.id + 1, type }));
  }

  const initialCenter: [number, number] = userPosition
    ? [userPosition.lat, userPosition.lon]
    : origin
      ? [origin.lat, origin.lon]
      : MEDINA_CENTER;

  const orderedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      const aActive = a.id === selectedRoute?.id ? 1 : 0;
      const bActive = b.id === selectedRoute?.id ? 1 : 0;
      return aActive - bActive;
    });
  }, [routes, selectedRoute?.id]);

  return (
    <>
      <MapContainer
        center={initialCenter}
        zoom={routes.length ? 16 : 15}
        scrollWheelZoom
        zoomControl={false}
        className="route-map"
        attributionControl
      >
        {baseLayer === "standard" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            attribution='EOxCloudless &copy; <a href="https://cloudless.eox.at">EOX</a> · modified Copernicus Sentinel data 2025'
            url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg"
            maxNativeZoom={14}
            maxZoom={19}
          />
        )}

        <ZoomControl position="bottomleft" />
        <ViewportController
          selectedRoute={selectedRoute}
          action={viewAction}
          userPosition={userPosition}
          followUser={followUser}
        />

        {orderedRoutes.map((route) => {
          if (!showAll && route.id !== selectedRoute?.id) return null;
          const active = route.id === selectedRoute?.id;
          const style = routeStyles[route.id] || routeStyles.balanced;
          return (
            <Polyline
              key={route.id}
              positions={route.coordinates}
              eventHandlers={onSelectRoute ? { click: () => onSelectRoute(route.id) } : undefined}
              pathOptions={{
                color: style.color,
                weight: active ? style.weight + 2 : Math.max(5, style.weight - 1),
                opacity: active ? 0.98 : 0.58,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          );
        })}

        {origin && (
          <CircleMarker
            center={[origin.lat, origin.lon]}
            radius={8}
            pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}
          >
            <Popup>نقطة البداية</Popup>
          </CircleMarker>
        )}
        {destination && (
          <CircleMarker
            center={[destination.lat, destination.lon]}
            radius={8}
            pathOptions={{ color: "#ffffff", fillColor: "#183d35", fillOpacity: 1, weight: 3 }}
          >
            <Popup>الوجهة</Popup>
          </CircleMarker>
        )}
        {userPosition && (
          <>
            {userPosition.accuracy && (
              <Circle
                center={[userPosition.lat, userPosition.lon]}
                radius={Math.max(8, userPosition.accuracy)}
                pathOptions={{ color: "#1472a3", fillColor: "#1472a3", fillOpacity: 0.08, weight: 1 }}
              />
            )}
            <CircleMarker
              center={[userPosition.lat, userPosition.lon]}
              radius={9}
              pathOptions={{ color: "#ffffff", fillColor: "#1472a3", fillOpacity: 1, weight: 3 }}
            >
              <Popup>موقعك الحالي</Popup>
            </CircleMarker>
          </>
        )}
      </MapContainer>

      <div className="map-tools" aria-label="أدوات الخريطة">
        <button type="button" onClick={() => runViewAction("center")} title={userPosition ? "العودة إلى موقعي" : "إعادة التوسيط"}>
          <LocateFixed size={15} /><span>{userPosition ? "موقعي" : "توسيط"}</span>
        </button>
        {selectedRoute && (
          <button type="button" onClick={() => runViewAction("fit")} title="إظهار المسار كاملًا">
            <ScanLine size={15} /><span>المسار</span>
          </button>
        )}
        <button
          type="button"
          className={baseLayer === "aerial" ? "is-active" : ""}
          onClick={() => setBaseLayer((current) => current === "standard" ? "aerial" : "standard")}
          title="تغيير نمط الخريطة"
        >
          <Layers3 size={15} /><span>{baseLayer === "standard" ? "عرض جوي" : "خريطة"}</span>
        </button>
      </div>

      <div className="map-legend" aria-label="مفتاح الخريطة">
        {selectedRoute && <span><i className="route" /> المسار المحدد</span>}
        {userPosition && <span><i className="gps" /> موقعك المباشر</span>}
        <span>{baseLayer === "aerial" ? "عرض جوي" : "خريطة"}</span>
      </div>
    </>
  );
}
