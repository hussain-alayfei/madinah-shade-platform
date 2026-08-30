"use client";

import Link from "next/link";
import { Accessibility, ArrowRight, ChevronDown, Navigation, RefreshCw, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchLiveRoutes,
  formatDistance,
  formatDuration,
  parseLiveTrip,
  tripToSearchParams,
  type LiveRoute,
} from "@/lib/maps";
import { MapView } from "./MapView";
import { StatusMessage } from "./StatusMessage";

type GeocodeResult = {
  label: string;
  lat: number;
  lon: number;
};

export function RoutePlannerView() {
  const router = useRouter();
  const params = useSearchParams();
  const trip = useMemo(() => parseLiveTrip(params), [params]);
  const [routes, setRoutes] = useState<LiveRoute[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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

  async function searchDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trip || !searchQuery.trim()) return;

    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
      const payload = (await response.json().catch(() => null)) as { results?: GeocodeResult[]; error?: string } | null;
      const result = payload?.results?.[0];
      if (!response.ok || !result) throw new Error(payload?.error || "ما لقينا المكان المطلوب.");

      const nextTrip = {
        ...trip,
        destination: { lat: result.lat, lon: result.lon },
        destinationLabel: result.label,
      };
      setSearchOpen(false);
      setSearchQuery("");
      router.replace(`/plan?${tripToSearchParams(nextTrip).toString()}`);
    } catch (searchFailure) {
      setSearchError(searchFailure instanceof Error ? searchFailure.message : "تعذر البحث عن المكان الآن.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    setDetailsOpen(false);
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
            onSelectRoute={(routeId) => {
              setSelected(routeId);
              setDetailsOpen(false);
            }}
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
        <button
          type="button"
          className="route-map-search-toggle"
          aria-label={searchOpen ? "إغلاق البحث" : "البحث عن مكان"}
          onClick={() => {
            setSearchOpen((value) => !value);
            setSearchError("");
          }}
        >
          {searchOpen ? <X size={18} /> : <Search size={18} />}
          <span>بحث</span>
        </button>
      </div>

      {searchOpen && (
        <form className="route-map-search" onSubmit={searchDestination}>
          <Search size={17} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="ابحث عن مسجد، محطة، مطعم…"
            autoFocus
          />
          <button type="submit" disabled={searching || searchQuery.trim().length < 2}>
            {searching ? "نبحث…" : "عرض"}
          </button>
          {searchError && <small role="alert">{searchError}</small>}
        </form>
      )}

      <section className={`route-picker-sheet ${detailsOpen ? "is-expanded" : ""}`} aria-label="اختيار المسار">
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
              <strong>{formatDuration(selectedRoute.durationMinutes)}</strong>
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
                  onClick={() => {
                    setSelected(route.id);
                    setDetailsOpen(false);
                  }}
                >
                  <span className="route-choice__line" aria-hidden="true" />
                  <span className="route-choice__copy">
                    <strong>{route.name.replace("المسار ", "")}</strong>
                    <small>{formatDuration(route.durationMinutes)} · {formatDistance(route.distanceMeters)}</small>
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

        {selectedRoute && detailsOpen && (
          <div className="route-inline-details">
            <div className="route-inline-facts">
              <div><span>المدة</span><strong>{formatDuration(selectedRoute.durationMinutes)}</strong></div>
              <div><span>المسافة</span><strong>{formatDistance(selectedRoute.distanceMeters)}</strong></div>
              <div><span>الإتاحة</span><strong>{selectedRoute.wheelchairAware ? "مراعاة أعلى" : "قياسية"}</strong></div>
            </div>

            <details className="route-steps-disclosure">
              <summary>
                <span>خطوات الطريق</span>
                <small>{selectedRoute.maneuvers.length} خطوة</small>
                <ChevronDown size={16} />
              </summary>
              <div className="route-steps-list">
                {selectedRoute.maneuvers.map((maneuver, index) => (
                  <div key={`${maneuver.beginShapeIndex}-${index}`}>
                    <span>{index + 1}</span>
                    <p><strong>{maneuver.instruction}</strong><small>{formatDistance(maneuver.distanceMeters)}</small></p>
                  </div>
                ))}
              </div>
            </details>

            {selectedRoute.wheelchairAware && (
              <div className="route-accessibility-note"><Accessibility size={16} /> تم إعطاء أولوية أعلى لمسار مناسب لاحتياج الوصول المحدد.</div>
            )}
          </div>
        )}

        {selectedRoute && (
          <div className="route-sheet-actions">
            <button
              type="button"
              className="route-details-link"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((value) => !value)}
            >
              {detailsOpen ? "إخفاء التفاصيل" : "التفاصيل"}
            </button>
            <Link href={`/navigate?${tripQuery}&route=${selectedRoute.id}`} className="route-start-button">
              <Navigation size={18} /> ابدأ المشي
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
