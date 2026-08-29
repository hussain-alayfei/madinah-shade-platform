"use client";

import Link from "next/link";
import { ArrowLeft, Navigation } from "lucide-react";
import { useState } from "react";
import { routeOptions } from "@/lib/data";
import { MapView } from "./MapView";
import { RouteCard } from "./RouteCard";

export function RoutePlannerView() {
  const [selected, setSelected] = useState("comfortable");
  const selectedRoute = routeOptions.find((route) => route.id === selected) ?? routeOptions[0];

  return (
    <main className="plan-shell">
      <section className="plan-panel">
        <div className="section-header">
          <Link href="/" className="text-action">
            <ArrowLeft size={16} />
            تعديل الرحلة
          </Link>
          <h1>اختر المسار المناسب</h1>
          <p>من موقعك الحالي إلى المسجد النبوي · الانطلاق الآن</p>
        </div>

        <div className="route-list">
          {routeOptions.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              selected={route.id === selected}
              onSelect={() => setSelected(route.id)}
            />
          ))}
        </div>

        <div className="plan-actions">
          <Link href={`/navigate?route=${selectedRoute.id}`} className="primary-action">
            <Navigation size={19} />
            ابدأ {selectedRoute.name}
          </Link>
        </div>
      </section>

      <section className="plan-map" aria-label="مقارنة المسارات على الخريطة">
        <div className="map-frame">
          <MapView selected={selected} showAll />
          <div className="map-context">
            <strong>{selectedRoute.name}</strong>
            <span>{selectedRoute.duration} دقيقة · {selectedRoute.distance} م · راحة {selectedRoute.comfort}/100</span>
          </div>
        </div>
      </section>
    </main>
  );
}
