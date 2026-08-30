"use client";

import Link from "next/link";
import { Accessibility, ArrowRight, MapPinned, Navigation, RefreshCw, Route, ShieldCheck, Timer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLiveRoutes, formatDistance, parseLiveTrip, tripToSearchParams, type LiveRoute } from "@/lib/maps";
import { MapView } from "./MapView";
import styles from "./RouteDetails.module.css";

export function RouteDetails() {
  const params = useSearchParams();
  const trip = useMemo(() => parseLiveTrip(params), [params]);
  const routeId = params.get("route") || "comfortable";
  const [routes, setRoutes] = useState<LiveRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() { if (!trip) { setLoading(false); setError("بيانات الرحلة ناقصة."); return; } setLoading(true); setError(""); try { setRoutes(await fetchLiveRoutes(trip)); } catch (routeError) { setError(routeError instanceof Error ? routeError.message : "تعذر تحميل المسار."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [trip]);
  if (!trip) return <main className="content-shell content-shell--narrow"><div className="logic-error">بيانات الرحلة غير موجودة. <Link href="/">ابدأ من جديد</Link>.</div></main>;
  const route = routes.find((item) => item.id === routeId) || routes[0];
  const tripQuery = tripToSearchParams(trip).toString();
  return <main className={styles.layout}>
    <section className={styles.details}>
      <div className={styles.back}><Link href={`/plan?${tripQuery}`} className="text-action"><ArrowRight size={16} />العودة للمسارات</Link></div>
      {loading && <div className="route-loading">جاري تحميل الطريق والتوجيهات الفعلية…</div>}
      {error && <div className="logic-error" role="alert"><span>{error}</span><button type="button" className="secondary-action" onClick={() => void load()}><RefreshCw size={16} /> إعادة المحاولة</button></div>}
      {route && <><h1>{route.name}</h1><p className={styles.description}>{route.description}</p>
        <div className={styles.summary}><div><span>المدة</span><strong>{route.durationMinutes} دقيقة</strong></div><div><span>المسافة</span><strong>{formatDistance(route.distanceMeters)}</strong></div><div><span>المصدر</span><strong>OSM</strong></div></div>
        <section className={styles.section}><h2>ما الذي يعمل فعليًا؟</h2><div className={styles.fact}><span><Route size={16} /> خط مسار المشي</span><strong>محسوب الآن</strong></div><div className={styles.fact}><span><Timer size={16} /> الزمن والمسافة</span><strong>من محرك التوجيه</strong></div><div className={styles.fact}><span><MapPinned size={16} /> تعليمات الاتجاهات</span><strong>{route.maneuvers.length} خطوة</strong></div><div className={styles.fact}><span><Accessibility size={16} /> وضع الكرسي المتحرك</span><strong>{route.wheelchairAware ? "مفعّل" : "غير مطلوب"}</strong></div></section>
        <section className={styles.section}><h2>أول تعليمات الرحلة</h2><div className="maneuver-preview">{route.maneuvers.slice(0,5).map((maneuver,index) => <div className="maneuver-row" key={`${maneuver.beginShapeIndex}-${index}`}><span>{index+1}</span><div><strong>{maneuver.instruction}</strong><small>{formatDistance(maneuver.distanceMeters)}</small></div></div>)}</div></section>
        <div className="live-source-note" style={{ marginTop:18 }}><ShieldCheck size={18}/><div><strong>لا نخلط البيانات الحقيقية بالتقديرية.</strong><span>المسار والتوجيهات حقيقية. الظل والحرارة والازدحام اللحظي تحتاج طبقات بيانات تشغيلية منفصلة، لذلك أزلنا الأرقام الوهمية منها بدل عرضها كمعلومة مؤكدة.</span></div></div>
        <div className={styles.actions}><Link href={`/navigate?${tripQuery}&route=${route.id}`} className="primary-action"><Navigation size={18}/>ابدأ التتبع الحي</Link></div></>}
    </section>
    <section className={styles.map} aria-label="تفاصيل المسار على الخريطة"><div className="map-frame"><MapView routes={route ? [route] : []} selected={route?.id} showAll={false} origin={trip.origin} destination={trip.destination}/><div className="map-context"><strong>{route ? "مسار فعلي" : "جاري تجهيز المسار"}</strong><span>{trip.originLabel} ← {trip.destinationLabel}</span></div></div></section>
  </main>;
}
