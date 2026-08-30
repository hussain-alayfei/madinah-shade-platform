"use client";

import Link from "next/link";
import { ArrowRight, RefreshCw, SearchCheck, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLiveRoutes, parseLiveTrip, tripToSearchParams, type LiveRoute } from "@/lib/maps";
import { MapView } from "./MapView";
import { RouteCard } from "./RouteCard";

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
      setSelected((current) => current && nextRoutes.some((route) => route.id === current) ? current : nextRoutes[0].id);
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "تعذر حساب المسارات.");
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
        <div className="logic-error">بيانات الرحلة غير موجودة. <Link href="/">ابدأ رحلة جديدة</Link>.</div>
      </main>
    );
  }

  const selectedRoute = routes.find((route) => route.id === selected) || routes[0];
  const tripQuery = tripToSearchParams(trip).toString();

  return (
    <main className="plan-shell">
      <section className="plan-panel">
        <div className="section-header">
          <Link href="/" className="text-action"><ArrowRight size={16} />تعديل الرحلة</Link>
          <h1>اختر المسار المناسب</h1>
          <p>{trip.originLabel} ← {trip.destinationLabel}</p>
        </div>

        <div className="live-source-note">
          <ShieldCheck size={18} />
          <div>
            <strong>كل خيار ظاهر هنا يمثل طريقًا مختلفًا فعليًا.</strong>
            <span>إذا لم نجد ثلاثة طرق مختلفة بوضوح، نعرض عددًا أقل بدل تكرار نفس المسار بأسماء مختلفة.</span>
          </div>
        </div>

        {loading && <div className="route-loading">جاري تجهيز طرق المشي المتاحة…</div>}

        {error && (
          <div className="logic-error" role="alert">
            <span>{error}</span>
            <div className="logic-error__actions">
              <Link href="/" className="secondary-action">تعديل الرحلة</Link>
              <button type="button" className="secondary-action" onClick={() => void loadRoutes()}><RefreshCw size={16} /> إعادة المحاولة</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="route-count-note">
              {routes.length === 1 ? "يتوفر طريق واحد واضح بين النقطتين." : `وجدنا ${routes.length} مسارات مختلفة بين النقطتين.`}
            </p>
            <div className="route-list">
              {routes.map((route, index) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  recommended={index === 0}
                  selected={route.id === selected}
                  onSelect={() => setSelected(route.id)}
                />
              ))}
            </div>
          </>
        )}

        {selectedRoute && (
          <div className="plan-actions">
            <Link href={`/route?${tripQuery}&route=${selectedRoute.id}`} className="primary-action">
              <SearchCheck size={19} />
              راجع {selectedRoute.name}
            </Link>
          </div>
        )}
      </section>

      <section className="plan-map" aria-label="مقارنة المسارات على الخريطة">
        <div className="map-frame">
          <MapView routes={routes} selected={selectedRoute?.id} showAll origin={trip.origin} destination={trip.destination} />
          <div className="map-context">
            <strong>{selectedRoute?.name || "جاري تجهيز المسارات"}</strong>
            <span>{selectedRoute ? `${selectedRoute.durationMinutes} دقيقة · ${Math.round(selectedRoute.distanceMeters)} م` : `${trip.originLabel} ← ${trip.destinationLabel}`}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
