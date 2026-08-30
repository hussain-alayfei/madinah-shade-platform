"use client";

import "leaflet/dist/leaflet.css";
import { latLngBounds } from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { categoryLabel, type CitySignal } from "@/lib/city-dashboard";

const categoryColors: Record<CitySignal["category"], string> = {
  heat: "#9b6b27",
  crowding: "#a54536",
  accessibility: "#8f6b3f",
  services: "#506a61",
};

function CityViewportSync({ signals, selectedId }: { signals: CitySignal[]; selectedId?: string }) {
  const map = useMap();

  useEffect(() => {
    const selected = signals.find((signal) => signal.id === selectedId);
    if (selected) {
      map.flyTo(selected.coordinates, Math.max(map.getZoom(), 17), { duration: 0.55 });
      return;
    }

    if (signals.length === 1) {
      map.flyTo(signals[0].coordinates, 17, { duration: 0.45 });
      return;
    }

    if (signals.length > 1) {
      const bounds = latLngBounds(signals.map((signal) => signal.coordinates));
      map.fitBounds(bounds.pad(0.28), { animate: true, duration: 0.45, maxZoom: 16 });
    }
  }, [map, selectedId, signals]);

  return null;
}

export function CityMapClient({
  signals,
  selectedId,
  onSelect,
}: {
  signals: CitySignal[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <MapContainer
      center={[24.4696, 39.6135]}
      zoom={16}
      scrollWheelZoom
      className="route-map"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <CityViewportSync signals={signals} selectedId={selectedId} />

      {signals.map((signal) => {
        const selected = signal.id === selectedId;
        const color = categoryColors[signal.category];
        return (
          <Circle
            key={signal.id}
            center={signal.coordinates}
            radius={signal.radiusMeters}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: selected ? 0.25 : 0.13,
              weight: selected ? 4 : 2,
            }}
            eventHandlers={{ click: () => onSelect?.(signal.id) }}
          >
            <Popup>
              <strong>{signal.title}</strong>
              <br />
              {signal.location}
              <br />
              <small>{categoryLabel(signal.category)} · أولوية {signal.priorityScore}</small>
            </Popup>
          </Circle>
        );
      })}

      <CircleMarker
        center={[24.46775, 39.61645]}
        radius={6}
        pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}
      >
        <Popup>نقطة مرجعية للنطاق التجريبي</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
