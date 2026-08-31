"use client";

import "leaflet/dist/leaflet.css";
import { latLngBounds } from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { categoryLabel, type CitySignal } from "@/lib/city-dashboard";

const categoryColors: Record<CitySignal["category"], string> = {
  heat: "#9b6b27",
  crowding: "#a54536",
  accessibility: "#8f6b3f",
  services: "#506a61",
};

/**
 * Keep the city map stable when React state changes.
 *
 * Previously every selected signal triggered flyTo(), while changing filters or
 * intervention state could also trigger fitBounds(). On mobile that meant two
 * competing camera animations and visible circle redraws. The map now fits only
 * when the actual set of map points changes; selecting a point only highlights it.
 */
function CityMapStability({ signals }: { signals: CitySignal[] }) {
  const map = useMap();
  const lastDatasetKey = useRef("");
  const resizeFrame = useRef<number | null>(null);

  const datasetKey = useMemo(
    () =>
      signals
        .map((signal) => `${signal.id}:${signal.coordinates[0].toFixed(5)}:${signal.coordinates[1].toFixed(5)}`)
        .sort()
        .join("|"),
    [signals],
  );

  useEffect(() => {
    if (!signals.length || datasetKey === lastDatasetKey.current) return;
    lastDatasetKey.current = datasetKey;

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });

      if (signals.length === 1) {
        map.setView(signals[0].coordinates, 16, { animate: false });
        return;
      }

      const bounds = latLngBounds(signals.map((signal) => signal.coordinates));
      map.fitBounds(bounds.pad(0.22), {
        animate: false,
        maxZoom: 16,
        padding: [24, 24],
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [datasetKey, map, signals]);

  useEffect(() => {
    const container = map.getContainer();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current);
      resizeFrame.current = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false, pan: false });
        resizeFrame.current = null;
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (resizeFrame.current !== null) window.cancelAnimationFrame(resizeFrame.current);
    };
  }, [map]);

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
      preferCanvas
      className="route-map city-stable-map"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <CityMapStability signals={signals} />

      {signals.map((signal) => {
        const selected = signal.id === selectedId;
        const color = categoryColors[signal.category];
        return (
          <Circle
            key={signal.id}
            center={signal.coordinates}
            radius={signal.radiusMeters}
            bubblingMouseEvents={false}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: selected ? 0.24 : 0.12,
              opacity: selected ? 1 : 0.82,
              weight: selected ? 3 : 2,
            }}
            eventHandlers={{ click: () => onSelect?.(signal.id) }}
          >
            <Popup autoPan={false} keepInView={false}>
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
        bubblingMouseEvents={false}
        pathOptions={{ color: "#ffffff", fillColor: "#0f6b54", fillOpacity: 1, weight: 3 }}
      >
        <Popup autoPan={false}>نقطة مرجعية للنطاق التجريبي</Popup>
      </CircleMarker>
    </MapContainer>
  );
}