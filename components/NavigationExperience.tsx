"use client";

import Link from "next/link";
import { CircleAlert, Flag, LocateFixed, Navigation2, RefreshCw, Route as RouteIcon, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  fetchLiveRoutes,
  formatDistance,
  haversineMeters,
  nearestRoutePoint,
  parseLiveTrip,
  tripToSearchParams,
  type LiveRoute,
  type UserPosition,
} from "@/lib/maps";
import { MapView } from "./MapView";

type LocationStatus = "starting" | "tracking" | "denied" | "unavailable" | "error";

export function NavigationExperience() {
  const params = useSearchParams();
  const router = useRouter();
  const trip = useMemo(() => parseLiveTrip(params), [params]);
  const requestedRouteId = params.get("route") || "comfortable";
  const [route, setRoute] = useState<LiveRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeError, setRouteError] = useState("");
  const [userPosition, setUserPosition] = useState<UserPosition | undefined>();
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("starting");
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [remainingMeters, setRemainingMeters] = useState(0);
  const [rerouting, setRerouting] = useState(false);

  async function loadRoute(originOverride?: UserPosition) {
    if (!trip) {
      setLoading(false);
      setRouteError("بيانات الرحلة ناقصة.");
      return;
    }
    setLoading(true);
    setRouteError("");
    try {
      const nextTrip = originOverride
        ? { ...trip, origin: { lat: originOverride.lat, lon: originOverride.lon }, originLabel: "موقعي الحالي" }
        : trip;
      const routes = await fetchLiveRoutes(nextTrip);
      const nextRoute = routes.find((item) => item.id === requestedRouteId) || routes[0];
      setRoute(nextRoute);
      setProgress(0);
      setStepIndex(0);
      setRemainingMeters(nextRoute.distanceMeters);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "تعذر تحميل الملاحة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoute();
  }, [trip, requestedRouteId]);

  useEffect(() => {
    if (!route || !trip) return;
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("starting");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const current: UserPosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setUserPosition(current);
        setLocationStatus("tracking");

        const nearest = nearestRoutePoint(route.coordinates, current);
        const tolerance = Math.max(55, (current.accuracy || 0) * 1.5);
        setOffRoute(nearest.distance > tolerance);

        const nextProgress = route.coordinates.length > 1
          ? Math.min(100, Math.round((nearest.index / (route.coordinates.length - 1)) * 100))
          : 0;
        setProgress(nextProgress);
        setRemainingMeters(Math.max(0, Math.round(route.distanceMeters * (1 - nextProgress / 100))));

        const nextStep = route.maneuvers.findIndex((maneuver) => maneuver.endShapeIndex >= nearest.index);
        if (nextStep >= 0) setStepIndex(nextStep);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setLocationStatus("denied");
        else if (error.code === error.POSITION_UNAVAILABLE) setLocationStatus("unavailable");
        else setLocationStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationAttempt, route, trip]);

  if (!trip) {
    return (
      <main className="content-shell content-shell--narrow">
        <div className="logic-error">بيانات الرحلة غير موجودة. <Link href="/">ابدأ رحلة جديدة</Link>.</div>
      </main>
    );
  }

  const step = route?.maneuvers[Math.min(stepIndex, Math.max(0, (route?.maneuvers.length || 1) - 1))];
  const destinationDistance = userPosition ? haversineMeters(userPosition, trip.destination) : Number.POSITIVE_INFINITY;
  const arrived = destinationDistance <= 35;
  const remainingMinutes = route ? Math.max(1, Math.round(route.durationMinutes * Math.max(0.05, 1 - progress / 100))) : 0;
  const tripQuery = tripToSearchParams(trip).toString();

  async function reroute() {
    if (!userPosition || !trip) return;
    setRerouting(true);
    setRouteError("");
    try {
      const updatedTrip = { ...trip, origin: { lat: userPosition.lat, lon: userPosition.lon }, originLabel: "موقعي الحالي" };
      const routes = await fetchLiveRoutes(updatedTrip);
      const nextRoute = routes.find((item) => item.id === requestedRouteId) || routes[0];
      setRoute(nextRoute);
      setProgress(0);
      setStepIndex(0);
      setOffRoute(false);
      setRemainingMeters(nextRoute.distanceMeters);
      const query = tripToSearchParams(updatedTrip);
      query.set("route", nextRoute.id);
      router.replace(`/navigate?${query.toString()}`);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "تعذر إعادة حساب الطريق.");
    } finally {
      setRerouting(false);
    }
  }

  const arrivalQuery = new URLSearchParams({
    routeName: route?.name || "مسار المشي",
    duration: String(route?.durationMinutes || 0),
    distance: String(route?.distanceMeters || 0),
    destination: trip.destinationLabel,
  });

  return (
    <main className="navigation-shell">
      <section className="navigation-map" aria-label="الملاحة الحية">
        <div className="map-frame">
          <MapView
            routes={route ? [route] : []}
            selected={route?.id}
            showAll={false}
            origin={trip.origin}
            destination={trip.destination}
            userPosition={userPosition}
            followUser={locationStatus === "tracking"}
          />
          <Link href={`/route?${tripQuery}&route=${requestedRouteId}`} className="nav-exit-button" aria-label="إغلاق الملاحة">
            <X size={20} />
          </Link>
          <div className="map-context nav-map-context">
            <strong>{route?.name || "جاري تحميل المسار"}</strong>
            <span>{locationStatus === "tracking" ? `موقع مباشر · دقة تقريبية ${Math.round(userPosition?.accuracy || 0)} م` : "بانتظار تحديد موقعك"}</span>
          </div>
        </div>
      </section>

      <section className="navigation-sheet">
        <div className="navigation-sheet__handle" aria-hidden="true" />

        {loading && <div className="route-loading">جاري تجهيز الملاحة…</div>}
        {routeError && (
          <div className="logic-error" role="alert">
            <span>{routeError}</span>
            <button type="button" className="secondary-action" onClick={() => void loadRoute(userPosition)}><RefreshCw size={16} /> إعادة المحاولة</button>
          </div>
        )}

        {route && (
          <div className="navigation-sheet__inner">
            <div>
              <div className="nav-instruction">
                <div className="nav-instruction__icon">{arrived ? <Flag size={28} /> : <Navigation2 size={29} />}</div>
                <div>
                  <h1>{arrived ? "وصلت إلى وجهتك" : step?.instruction || "استمر على المسار"}</h1>
                  <p>{arrived ? trip.destinationLabel : `${step ? formatDistance(step.distanceMeters) : formatDistance(remainingMeters)} · ${trip.destinationLabel}`}</p>
                </div>
              </div>
              <div className="nav-progress" aria-label={`تقدم تقريبي على المسار ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
            </div>

            <div>
              <div className="nav-status">
                <div><span>المتبقي</span><strong>{remainingMinutes} د</strong></div>
                <div><span>المسافة</span><strong>{formatDistance(remainingMeters)}</strong></div>
                <div><span>الموقع</span><strong>{locationStatus === "tracking" ? "متصل" : "غير متصل"}</strong></div>
              </div>
              {arrived && <Link href={`/arrival?${arrivalQuery.toString()}`} className="primary-action" style={{ marginTop: 10 }}>إنهاء الرحلة</Link>}
            </div>
          </div>
        )}

        {locationStatus !== "tracking" && (
          <div className="gps-permission-card">
            <LocateFixed size={18} />
            <div>
              <strong>{locationStatus === "denied" ? "إذن الموقع غير مفعّل" : locationStatus === "unavailable" ? "تعذر تحديد موقعك" : locationStatus === "error" ? "حدث خطأ في تحديد الموقع" : "جاري تشغيل الموقع المباشر"}</strong>
              <span>لتحريك المؤشر معك أثناء المشي، اسمح للتطبيق باستخدام موقع الجهاز.</span>
            </div>
            {(locationStatus === "denied" || locationStatus === "unavailable" || locationStatus === "error") && (
              <button type="button" className="secondary-action" onClick={() => setLocationAttempt((value) => value + 1)}>المحاولة مجددًا</button>
            )}
          </div>
        )}

        {offRoute && userPosition && (
          <div className="nav-decision">
            <CircleAlert size={18} />
            <div className="nav-decision__copy">
              <strong>يبدو أنك ابتعدت عن الطريق</strong>
              <span>يمكننا تجهيز طريق جديد من موقعك الحالي إلى {trip.destinationLabel}.</span>
            </div>
            <button type="button" className="nav-decision__action" onClick={() => void reroute()} disabled={rerouting}>
              <RouteIcon size={15} />{rerouting ? "جاري الحساب…" : "إعادة حساب المسار"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
