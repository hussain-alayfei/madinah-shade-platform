"use client";

import Link from "next/link";
import { ArrowRight, Navigation, RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLiveRoutes, formatDistance, parseLiveTrip, tripToSearchParams, type LiveRoute } from "@/lib/maps";
import { MapView } from "./MapView";
import { StatusMessage } from "./StatusMessage";

export function RoutePlannerView() {
  const params = useSearchParams();
  const trip = useMemo(() => parseLiveTrip(params), [params]);
  const [routes, setRoutes] = useState<LiveRoute[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRoutes() {
    if (!trip) {
      setLoading(false);
      setError("بيانات الرحلة ناقصة. ابدأ من الصفحة الرئيسية.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const nextRoutes = await fetchLiveRoutes(trip);
      setRoutes(nextRoutes);
      setSelected((current) =>
        current && nextRoutes.some((route) => route.id === current) ? current : nextRoutes[0].id,
      );
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "تعذر حساب المسارات الآن.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoutes();
  }, [trip]);

  if (!trip) {
    return (
      <main className="content-shell content-shell--narrow">
        <StatusMessage
          tone="warning"
          title="بيانات الرحلة غير مكتملة"
          description="ارجع للبداية وحدد نقطة الانطلاق والوجهة من جديد."
          action={<Link href="/">ابدأ رحلة جديدة</Link>}
        />
      </main>
    );
  }

  const selectedRoute = routes.find((route) => route.id === selected) || routes[0];
  const tripQuery = tripToSearchParams(trip).toString();

  return (
    <main className="route-map-screen">
      <section className="route-map-canvas" aria-label="خريطة مقارنة المسارات">
        <div className="map-frame">
          <MapView
            routes={routes}
            selected={selectedRoute?.id}
            showAll
            origin={trip.origin}
            destination={trip.destination}
            onSelectRoute={(routeId) => setSelected(routeId)}
          />
        </div>
      </section>

      <div className="route-map-toolbar">
        <Link href="/" className="route-map-back" aria-label="العودة لتعديل الرحلة">
          <ArrowRight size={19} />
        </Link>
        <div className="route-map-trip">
          <span>{trip.originLabel}</span>
          <strong>{trip.destinationLabel}</strong>
        </div>
        <Link href="/" className="route-map-edit">غيّر</Link>
      </div>

      <section className="route-picker-sheet" aria-label="اختيار المسار">
        <div className="route-sheet-handle" aria-hidden="true" />

        <header className="route-sheet-header">
          <div>
            <h1>وش المسار اللي يناسبك؟</h1>
            <p>
              {loading
                ? "نجهز لك الخيارات…"
                : routes.length > 1
                  ? `${routes.length} مسارات مختلفة`
                  : "هذا المسار المتاح بين النقطتين"}
            </p>
          </div>
          {selectedRoute && (
            <div className="route-sheet-primary-stat">
              <strong>{selectedRoute.durationMinutes} د</strong>
              <span>{formatDistance(selectedRoute.distanceMeters)}</span>
            </div>
          )}
        </header>

        {loading && <div className="route-loading route-loading--sheet">نرتب لك طرق المشي…</div>}

        {error && (
          <StatusMessage
            tone="warning"
            title="ما قدرنا نجهز المسار"
            description={error}
            action={(
              <button type="button" onClick={() => void loadRoutes()}>
                <RefreshCw size={14} /> حاول مرة ثانية
              </button>
            )}
          />
        )}

        {!loading && !error && (
          <div className="route-switcher" role="tablist" aria-label="المسارات المتاحة">
            {routes.map((route) => {
              const active = route.id === selectedRoute?.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`route-choice route-choice--${route.id} ${active ? "is-selected" : ""}`}
                  onClick={() => setSelected(route.id)}
                >
                  <span className="route-choice__line" aria-hidden="true" />
                  <span className="route-choice__copy">
                    <strong>{route.name.replace("المسار ", "")}</strong>
                    <small>{route.durationMinutes} د · {formatDistance(route.distanceMeters)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selectedRoute && (
          <div className="route-selected-summary">
            <strong>{selectedRoute.profileReason}</strong>
            <span>{selectedRoute.description}</span>
          </div>
        )}

        {selectedRoute && (
          <div className="route-sheet-actions">
            <Link href={`/route?${tripQuery}&route=${selectedRoute.id}`} className="route-details-link">
              التفاصيل
            </Link>
            <Link href={`/navigate?${tripQuery}&route=${selectedRoute.id}`} className="route-start-button">
              <Navigation size={18} /> ابدأ المشي
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
