"use client";

import Link from "next/link";
import { ArrowRight, Clock3, SearchCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  bestDeparture,
  departureOptions,
  parseDepartureTime,
  parsePreferences,
  recommendationReasons,
  routeOptions,
  routeScore,
  type DepartureTime,
} from "@/lib/data";
import { MapView } from "./MapView";
import { RouteCard } from "./RouteCard";

export function RoutePlannerView() {
  const params = useSearchParams();
  const needs = useMemo(() => parsePreferences(params.get("needs")), [params]);
  const [selectedTime, setSelectedTime] = useState<DepartureTime>(() => parseDepartureTime(params.get("time")));

  const rankedRoutes = useMemo(
    () => [...routeOptions].sort((a, b) => routeScore(b, needs, selectedTime) - routeScore(a, needs, selectedTime)),
    [needs, selectedTime],
  );

  const bestRoute = rankedRoutes[0];
  const [selected, setSelected] = useState(bestRoute.id);

  useEffect(() => {
    setSelected(bestRoute.id);
  }, [bestRoute.id]);

  const selectedRoute = routeOptions.find((route) => route.id === selected) ?? bestRoute;
  const selectedComfort = selectedRoute.timeComfort[selectedTime];
  const bestTime = bestDeparture(selectedRoute);
  const needsQuery = needs.length ? `&needs=${needs.join(",")}` : "";

  return (
    <main className="plan-shell">
      <section className="plan-panel">
        <div className="section-header">
          <Link href="/" className="text-action">
            <ArrowRight size={16} />
            تعديل الرحلة
          </Link>
          <h1>اختر المسار المناسب</h1>
          <p>
            من موقعك الحالي إلى المسجد النبوي · {selectedTime}
            {needs.length ? ` · ${needs.length} احتياجات مخصصة` : ""}
          </p>
        </div>

        <section className="departure-comparison" aria-labelledby="departure-title">
          <div className="departure-comparison__title">
            <div>
              <h2 id="departure-title">وقت الانطلاق يغيّر الراحة</h2>
              <p>نحدّث ترتيب المسارات حسب الظل والحرارة المتوقعة في كل وقت.</p>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="departure-comparison__options">
            {departureOptions.map((time) => {
              const score = selectedRoute.timeComfort[time];
              const isBest = time === bestTime.time;
              return (
                <button
                  key={time}
                  type="button"
                  className={`${selectedTime === time ? "is-selected" : ""} ${isBest ? "is-best" : ""}`}
                  onClick={() => setSelectedTime(time)}
                >
                  <span>{time}</span>
                  <strong>{score}</strong>
                  <small>{isBest ? "أفضل وقت" : "راحة"}</small>
                </button>
              );
            })}
          </div>
        </section>

        <div className="route-list">
          {rankedRoutes.map((route, index) => (
            <RouteCard
              key={route.id}
              route={route}
              comfortScore={route.timeComfort[selectedTime]}
              recommended={index === 0}
              reasons={index === 0 ? recommendationReasons(route, needs) : []}
              selected={route.id === selected}
              onSelect={() => setSelected(route.id)}
            />
          ))}
        </div>

        <div className="plan-actions">
          <Link
            href={`/route?route=${selectedRoute.id}&time=${encodeURIComponent(selectedTime)}${needsQuery}`}
            className="primary-action"
          >
            <SearchCheck size={19} />
            راجع {selectedRoute.name}
          </Link>
        </div>
      </section>

      <section className="plan-map" aria-label="مقارنة المسارات على الخريطة">
        <div className="map-frame">
          <MapView selected={selected} showAll />
          <div className="map-context">
            <strong>{selectedRoute.name}</strong>
            <span>{selectedRoute.duration} دقيقة · {selectedRoute.distance} م · راحة {selectedComfort}/100</span>
          </div>
        </div>
      </section>
    </main>
  );
}
