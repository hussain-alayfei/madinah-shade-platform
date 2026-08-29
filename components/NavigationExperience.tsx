"use client";

import Link from "next/link";
import { ArrowUp, CircleAlert, Flag, LocateFixed, RefreshCcw, Route as RouteIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parsePreferences, routeOptions } from "@/lib/data";
import {
  activeManeuver,
  fetchWalkingRoute,
  formatDistance,
  formatDuration,
  haversineMeters,
  parseTripContext,
  routeProgress,
  type LiveRoute,
  type LocationFix,
  type RouteMode,
} from "@/lib/maps";
import { MapView } from "./MapView";

export function NavigationExperience() {
  const params = useSearchParams();
  const routeId = (params.get("route") || "comfortable") as RouteMode;
  const routeMeta = routeOptions.find((item) => item.id === routeId) ?? routeOptions[0];
  const needs = useMemo(() => parsePreferences(params.get("needs")), [params]);
  const trip = useMemo(() => parseTripContext(params), [params]);
  const [liveRoute, setLiveRoute] = useState<LiveRoute | null>(null);
  const [location, setLocation] = useState<LocationFix | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [routeError, setRouteError] = useState("");
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const snappedToGps = useRef(false);

  const calculate = useCallback(async (start: [number, number], reroute = false) => {
    if (!trip.end) return;
    reroute ? setRerouting(true) : setLoadingRoute(true);
    setRouteError("");
    try {
      const result = await fetchWalkingRoute({ start, end: trip.end, mode: routeId, needs });
      setLiveRoute(result);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "تعذر حساب الطريق.");
    } finally {
      setLoadingRoute(false);
      setRerouting(false);
    }
  }, [needs, routeId, trip.end]);

  useEffect(() => {
    if (!trip.start || !trip.end) {
      setLoadingRoute(false);
      setRouteError("بيانات البداية أو الوجهة غير مكتملة.");
      return;
    }
    calculate(trip.start);
  }, [calculate, trip.end, trip.start]);

  const handleLocation = useCallback((fix: LocationFix) => {
    setLocation(fix);
    setGpsError("");
  }, []);

  useEffect(() => {
    if (!location || !liveRoute || !trip.start || snappedToGps.current) return;
    const drift = haversineMeters([location.lat, location.lon], trip.start);
    if (drift > Math.max(35, location.accuracy * 1.2)) {
      snappedToGps.current = true;
      calculate([location.lat, location.lon], true);
    } else {
      snappedToGps.current = true;
    }
  }, [calculate, liveRoute, location, trip.start]);

  const progressState = useMemo(() => {
    if (!location || !liveRoute) return null;
    return routeProgress([location.lat, location.lon], liveRoute);
  }, [liveRoute, location]);

  const maneuver = useMemo(() => {
    if (!liveRoute || !progressState) return null;
    return activeManeuver(liveRoute, progressState.walkedMeters);
  }, [liveRoute, progressState]);

  const destinationDistance = useMemo(() => {
    if (!location || !trip.end) return Number.POSITIVE_INFINITY;
    return haversineMeters([location.lat, location.lon], trip.end);
  }, [location, trip.end]);

  const arrived = destinationDistance <= 35 && Boolean(location && location.accuracy <= 70);
  const offRoute = Boolean(
    progressState && location && location.accuracy <= 80 && progressState.offRouteMeters > Math.max(55, location.accuracy * 1.5),
  );
  const remainingSeconds = liveRoute && progressState && liveRoute.distanceMeters > 0
    ? liveRoute.durationSeconds * (progressState.remainingMeters / liveRoute.distanceMeters)
    : liveRoute?.durationSeconds || 0;

  async function rerouteFromGps() {
    if (!location || !trip.end) return;
    await calculate([location.lat, location.lon], true);
  }

  if (!trip.start || !trip.end) {
    return (
      <main className="content-shell content-shell--narrow">
        <div className="page-title"><h1>لا توجد رحلة نشطة</h1><p>ابدأ من الصفحة الرئيسية وحدد نقطة البداية والوجهة أولًا.</p></div>
        <Link href="/" className="primary-action">تخطيط رحلة</Link>
      </main>
    );
  }

  const routeGeometry = liveRoute ? { [routeId]: liveRoute.geometry } as Partial<Record<RouteMode, [number, number][]>> : {};
  const instruction = arrived ? "وصلت إلى وجهتك" : maneuver?.instruction || (loadingRoute ? "جاري تجهيز الطريق" : "اتبع المسار الظاهر على الخريطة");
  const instructionDistance = maneuver ? formatDistance(maneuver.remainingToManeuverMeters) : liveRoute ? formatDistance(liveRoute.distanceMeters) : "";

  return (
    <main className="navigation-shell">
      <section className="navigation-map" aria-label="الملاحة الحية باستخدام GPS">
        <div className="map-frame">
          <MapView selected={routeId} showAll={false} routes={routeGeometry} start={trip.start} end={trip.end} trackUser onLocationChange={handleLocation} onLocationError={setGpsError} />
          <div className="map-context nav-map-context"><strong>{routeMeta.name}</strong><span>{trip.toLabel} · {liveRoute ? `${formatDistance(liveRoute.distanceMeters)} · ${formatDuration(liveRoute.durationSeconds)}` : "جاري حساب المسار"}</span></div>
        </div>
      </section>

      <section className="navigation-sheet">
        <div className="navigation-sheet__handle" aria-hidden="true" />
        <div className="navigation-sheet__inner">
          <div>
            <div className="nav-instruction">
              <div className="nav-instruction__icon">{arrived ? <Flag size={28} /> : <ArrowUp size={29} />}</div>
              <div><h1>{instruction}</h1><p>{arrived ? `أنت على بعد ${Math.round(destinationDistance)} م تقريبًا من النقطة المحددة.` : instructionDistance}</p></div>
            </div>
            <div className="nav-progress" aria-label={`تقدم الرحلة ${progressState?.progress || 0}%`}><span style={{ width: `${progressState?.progress || 0}%` }} /></div>
          </div>
          <div>
            <div className="nav-status">
              <div><span>المتبقي</span><strong>{liveRoute ? formatDuration(remainingSeconds) : "—"}</strong></div>
              <div><span>GPS</span><strong>{location ? `±${Math.round(location.accuracy)}م` : "بانتظار الإذن"}</strong></div>
              <div><span>المسافة</span><strong>{progressState ? formatDistance(progressState.remainingMeters) : liveRoute ? formatDistance(liveRoute.distanceMeters) : "—"}</strong></div>
            </div>
            {arrived && <Link href={`/arrival?route=${routeId}`} className="primary-action" style={{ marginTop: 10 }}>إنهاء الرحلة</Link>}
          </div>
        </div>

        {!location && !gpsError && <div className="nav-decision is-info"><LocateFixed size={18} /><div className="nav-decision__copy"><strong>بانتظار GPS</strong><span>اسمح للمتصفح باستخدام موقعك. لن تتحرك الرحلة تلقائيًا أو بشكل وهمي.</span></div></div>}
        {gpsError && <div className="nav-decision"><CircleAlert size={18} /><div className="nav-decision__copy"><strong>التتبع متوقف</strong><span>{gpsError}</span></div></div>}
        {routeError && <div className="nav-decision"><CircleAlert size={18} /><div className="nav-decision__copy"><strong>تعذر حساب المسار</strong><span>{routeError}</span></div>{location && <button type="button" className="nav-decision__action" onClick={rerouteFromGps} disabled={rerouting}><RefreshCcw size={15} /> إعادة الحساب</button>}</div>}
        {offRoute && !routeError && <div className="nav-decision"><RouteIcon size={18} /><div className="nav-decision__copy"><strong>أنت خارج المسار بنحو {Math.round(progressState?.offRouteMeters || 0)} م</strong><span>يمكن إعادة حساب طريق المشي من موقع GPS الحالي إلى الوجهة.</span></div><button type="button" className="nav-decision__action" onClick={rerouteFromGps} disabled={rerouting}><RefreshCcw size={15} />{rerouting ? "جاري إعادة الحساب…" : "إعادة التوجيه"}</button></div>}
        {location && !offRoute && !gpsError && !routeError && !arrived && <div className="navigation-live-note"><span className="live-dot" /> التتبع حي من GPS · آخر تحديث {new Date(location.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>}
      </section>
    </main>
  );
}
