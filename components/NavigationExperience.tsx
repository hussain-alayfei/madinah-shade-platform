"use client";

import Link from "next/link";
import { CircleAlert, Flag, LocateFixed, Navigation2, RefreshCw, Route as RouteIcon, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchLiveRoutes,
  formatDistance,
  formatDuration,
  haversineMeters,
  isWithinMadinahServiceArea,
  nearestRoutePoint,
  parseLiveTrip,
  tripToSearchParams,
  type LatLng,
  type LiveRoute,
  type UserPosition,
} from "@/lib/maps";
import { MapView } from "./MapView";

type LocationStatus = "starting" | "tracking" | "denied" | "unavailable" | "error";
type StartContext = "far" | "outside" | null;

export function NavigationExperience() {
  const params = useSearchParams();
  const trip = useMemo(() => parseLiveTrip(params), [params]);
  const requestedRouteId = params.get("route") || "comfortable";
  const [route, setRoute] = useState<LiveRoute | null>(null);
  const [activeOrigin, setActiveOrigin] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeError, setRouteError] = useState("");
  const [userPosition, setUserPosition] = useState<UserPosition | undefined>();
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("starting");
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasJoinedRoute, setHasJoinedRoute] = useState(false);
  const [startContext, setStartContext] = useState<StartContext>(null);
  const [offRoute, setOffRoute] = useState(false);
  const [remainingMeters, setRemainingMeters] = useState(0);
  const [rerouting, setRerouting] = useState(false);
  const offRouteSamplesRef = useRef(0);
  const autoSyncStartedRef = useRef(false);

  async function loadRoute(originOverride?: UserPosition, joinAfterLoad = false) {
    if (!trip) {
      setLoading(false);
      setRouteError("بيانات الرحلة ناقصة.");
      return;
    }

    setLoading(true);
    setRouteError("");
    try {
      const nextTrip = originOverride
        ? {
            ...trip,
            origin: { lat: originOverride.lat, lon: originOverride.lon },
            originLabel: "موقعي الحالي",
            originMode: "current" as const,
          }
        : trip;
      const routes = await fetchLiveRoutes(nextTrip);
      const nextRoute = routes.find((item) => item.id === requestedRouteId) || routes[0];
      setRoute(nextRoute);
      setActiveOrigin(nextTrip.origin);
      setProgress(0);
      setStepIndex(0);
      setHasJoinedRoute(joinAfterLoad);
      setStartContext(null);
      setOffRoute(false);
      offRouteSamplesRef.current = 0;
      setRemainingMeters(nextRoute.distanceMeters);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "تعذر تحميل الملاحة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    autoSyncStartedRef.current = false;
    offRouteSamplesRef.current = 0;
    setHasJoinedRoute(false);
    setStartContext(null);
    setOffRoute(false);
    void loadRoute();
  }, [trip, requestedRouteId]);

  useEffect(() => {
    if (!trip) return;
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    setLocationStatus("starting");
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus("tracking");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setLocationStatus("denied");
        else if (error.code === error.POSITION_UNAVAILABLE) setLocationStatus("unavailable");
        else setLocationStatus("error");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationAttempt, trip?.origin.lat, trip?.origin.lon, trip?.destination.lat, trip?.destination.lon]);

  async function synchronizeFromCurrent() {
    if (!userPosition || !trip) return;
    if (!isWithinMadinahServiceArea(userPosition)) {
      setStartContext("outside");
      setOffRoute(false);
      return;
    }

    setRerouting(true);
    setRouteError("");
    try {
      await loadRoute(userPosition, true);
    } finally {
      setRerouting(false);
    }
  }

  useEffect(() => {
    if (!route || !trip || !userPosition || !activeOrigin) return;

    const accuracy = Math.max(0, userPosition.accuracy || 0);
    const joinTolerance = Math.max(60, accuracy * 1.6);
    const offRouteTolerance = Math.max(70, accuracy * 1.8);
    const nearest = nearestRoutePoint(route.coordinates, userPosition);
    const startDistance = haversineMeters(userPosition, activeOrigin);
    const originMode = trip.originMode || (trip.originLabel === "موقعي الحالي" ? "current" : "selected");

    if (!hasJoinedRoute) {
      if (nearest.distance <= joinTolerance) {
        setHasJoinedRoute(true);
        setStartContext(null);
        setOffRoute(false);
        offRouteSamplesRef.current = 0;
        return;
      }

      if (originMode === "current") {
        if (!isWithinMadinahServiceArea(userPosition)) {
          setStartContext("outside");
          setOffRoute(false);
          return;
        }

        if (startDistance <= Math.max(105, accuracy * 2.2)) {
          setHasJoinedRoute(true);
          setStartContext(null);
          setOffRoute(false);
          offRouteSamplesRef.current = 0;
          return;
        }

        if (!autoSyncStartedRef.current) {
          autoSyncStartedRef.current = true;
          void synchronizeFromCurrent();
          return;
        }

        setStartContext("far");
        setOffRoute(false);
        return;
      }

      setStartContext(isWithinMadinahServiceArea(userPosition) ? "far" : "outside");
      setOffRoute(false);
      return;
    }

    if (nearest.distance > offRouteTolerance) {
      offRouteSamplesRef.current += 1;
      if (offRouteSamplesRef.current >= 3) setOffRoute(true);
      return;
    }

    offRouteSamplesRef.current = 0;
    setOffRoute(false);
    setStartContext(null);

    const nextProgress = route.coordinates.length > 1
      ? Math.min(100, Math.round((nearest.index / (route.coordinates.length - 1)) * 100))
      : 0;
    setProgress(nextProgress);
    setRemainingMeters(Math.max(0, Math.round(route.distanceMeters * (1 - nextProgress / 100))));

    const nextStep = route.maneuvers.findIndex((maneuver) => maneuver.endShapeIndex >= nearest.index);
    if (nextStep >= 0) setStepIndex(nextStep);
  }, [
    activeOrigin?.lat,
    activeOrigin?.lon,
    hasJoinedRoute,
    route,
    trip,
    userPosition?.accuracy,
    userPosition?.lat,
    userPosition?.lon,
  ]);

  if (!trip) {
    return (
      <main className="content-shell content-shell--narrow">
        <div className="logic-error">بيانات الرحلة غير موجودة. <Link href="/">ابدأ رحلة جديدة</Link>.</div>
      </main>
    );
  }

  const step = route?.maneuvers[Math.min(stepIndex, Math.max(0, (route?.maneuvers.length || 1) - 1))];
  const destinationDistance = userPosition ? haversineMeters(userPosition, trip.destination) : Number.POSITIVE_INFINITY;
  const arrived = hasJoinedRoute && destinationDistance <= 35;
  const remainingMinutes = route ? Math.max(1, Math.round(route.durationMinutes * Math.max(0.05, 1 - progress / 100))) : 0;
  const tripQuery = tripToSearchParams(trip).toString();

  const arrivalQuery = new URLSearchParams({
    routeName: route?.name || "مسار المشي",
    duration: String(route?.durationMinutes || 0),
    distance: String(route?.distanceMeters || 0),
    destination: trip.destinationLabel,
  });

  return (
    <main className="navigation-shell navigation-shell--stable">
      <section className="navigation-map" aria-label="الملاحة الحية">
        <div className="map-frame">
          <MapView
            routes={route ? [route] : []}
            selected={route?.id}
            showAll={false}
            origin={activeOrigin || trip.origin}
            destination={trip.destination}
            userPosition={userPosition}
            followUser={locationStatus === "tracking" && hasJoinedRoute && !startContext}
          />
          <Link href={`/plan?${tripQuery}`} className="nav-exit-button" aria-label="إغلاق الملاحة والعودة للمسارات">
            <X size={20} />
          </Link>
        </div>
      </section>

      <section className="navigation-sheet navigation-sheet--stable">
        <div className="navigation-sheet__handle" aria-hidden="true" />

        {loading && <div className="route-loading">جاري تجهيز الملاحة…</div>}
        {routeError && (
          <div className="logic-error" role="alert">
            <span>{routeError}</span>
            <button type="button" className="secondary-action" onClick={() => void loadRoute(userPosition, Boolean(userPosition))}>
              <RefreshCw size={16} /> إعادة المحاولة
            </button>
          </div>
        )}

        {startContext && userPosition && !loading && (
          <div className="nav-start-context" role="status">
            <CircleAlert size={19} />
            <div className="nav-start-context__copy">
              <strong>{startContext === "outside" ? "أنت بعيد عن نطاق الرحلة" : "أنت بعيد عن نقطة البداية"}</strong>
              <span>
                {startContext === "outside"
                  ? `هذه الرحلة تبدأ من ${trip.originLabel}. سنبقي المسار المخطط ظاهرًا ولن نعتبر موقعك الحالي خروجًا عن الطريق.`
                  : `المسار يبدأ من ${trip.originLabel}. يمكنك الانتظار حتى تقترب منه أو بدء مسار جديد من موقعك الحالي.`}
              </span>
            </div>
            <div className="nav-start-context__actions">
              {isWithinMadinahServiceArea(userPosition) && (
                <button type="button" onClick={() => void synchronizeFromCurrent()} disabled={rerouting}>
                  <LocateFixed size={15} /> {rerouting ? "جاري التحديث…" : "ابدأ من موقعي الحالي"}
                </button>
              )}
              <Link href="/">تعديل الرحلة</Link>
            </div>
          </div>
        )}

        {route && !startContext && (
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
                <div><span>المتبقي</span><strong>{formatDuration(remainingMinutes)}</strong></div>
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
              <strong>{locationStatus === "denied" ? "إذن الموقع غير مفعّل" : locationStatus === "unavailable" ? "تعذر تحديد موقعك" : locationStatus === "error" ? "حدث خطأ في تحديد الموقع" : "جاري تحديد موقعك"}</strong>
              <span>اسمح للتطبيق باستخدام موقع الجهاز لتفعيل الملاحة أثناء المشي.</span>
            </div>
            {(locationStatus === "denied" || locationStatus === "unavailable" || locationStatus === "error") && (
              <button type="button" className="secondary-action" onClick={() => setLocationAttempt((value) => value + 1)}>المحاولة مجددًا</button>
            )}
          </div>
        )}

        {offRoute && userPosition && hasJoinedRoute && (
          <div className="nav-decision">
            <CircleAlert size={18} />
            <div className="nav-decision__copy">
              <strong>ابتعدت عن المسار</strong>
              <span>تأكدنا من عدة قراءات متتالية. يمكننا تحديث الطريق من موقعك الحالي.</span>
            </div>
            <button type="button" className="nav-decision__action" onClick={() => void synchronizeFromCurrent()} disabled={rerouting}>
              <RouteIcon size={15} />{rerouting ? "جاري الحساب…" : "تحديث المسار"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
