"use client";

import Link from "next/link";
import { Accessibility, ArrowRight, MapPinned, Navigation, RefreshCw, Route, ShieldCheck, Timer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLiveRoutes, formatDistance, parseLiveTrip, tripToSearchParams, type LiveRoute } from "@/lib/maps";
import { MapView } from "./MapView";
import { StatusMessage } from "./StatusMessage";
import styles from "./RouteDetails.module.css";

export function RouteDetails() {
  const params = useSearchParams();
  const trip = useMemo(() => parseLiveTrip(params), [params]);
  const routeId = params.get("route") || "comfortable";
  const [routes, setRoutes] = useState<LiveRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!trip) {
      setLoading(false);
      setError("بيانات الرحلة ناقصة.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRoutes(await fetchLiveRoutes(trip));
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "تعذر تحميل المسار الآن.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [trip]);

  if (!trip) {
    return (
      <main className="content-shell content-shell--narrow">
        <StatusMessage
          tone="warning"
          title="بيانات الرحلة غير مكتملة"
          description="ارجع للبداية وحدد نقطة الانطلاق والوجهة من جديد."
          action={<Link href="/">ابدأ من جديد</Link>}
        />
      </main>
    );
  }

  const route = routes.find((item) => item.id === routeId) || routes[0];
  const tripQuery = tripToSearchParams(trip).toString();

  return (
    <main className={styles.layout}>
      <section className={styles.details}>
        <div className={styles.back}>
          <Link href={`/plan?${tripQuery}`} className="text-action"><ArrowRight size={16} />العودة للمسارات</Link>
        </div>

        {loading && <div className="route-loading">جاري تجهيز تفاصيل الطريق…</div>}
        {error && (
          <StatusMessage
            tone="warning"
            title="تعذر تجهيز تفاصيل الطريق"
            description={error}
            action={(
              <button type="button" onClick={() => void load()}>
                <RefreshCw size={14} /> حاول مرة ثانية
              </button>
            )}
          />
        )}

        {route && (
          <>
            <h1>{route.name}</h1>
            <p className={styles.description}>{route.description}</p>

            <div className={styles.summary}>
              <div><span>المدة</span><strong>{route.durationMinutes} دقيقة</strong></div>
              <div><span>المسافة</span><strong>{formatDistance(route.distanceMeters)}</strong></div>
              <div><span>نوع الرحلة</span><strong>مشي</strong></div>
            </div>

            <section className={styles.section}>
              <h2>تفاصيل المسار</h2>
              <div className={styles.fact}><span><Route size={16} /> خط الطريق</span><strong>محسوب لهذه الرحلة</strong></div>
              <div className={styles.fact}><span><Timer size={16} /> الزمن والمسافة</span><strong>محدّثان مع المسار</strong></div>
              <div className={styles.fact}><span><MapPinned size={16} /> تعليمات الاتجاهات</span><strong>{route.maneuvers.length} خطوة</strong></div>
              <div className={styles.fact}><span><Accessibility size={16} /> مراعاة الإتاحة</span><strong>{route.wheelchairAware ? "مفعّلة" : "قياسية"}</strong></div>
            </section>

            <section className={styles.section}>
              <h2>بداية الطريق</h2>
              <div className="maneuver-preview">
                {route.maneuvers.slice(0, 5).map((maneuver, index) => (
                  <div className="maneuver-row" key={`${maneuver.beginShapeIndex}-${index}`}>
                    <span>{index + 1}</span>
                    <div><strong>{maneuver.instruction}</strong><small>{formatDistance(maneuver.distanceMeters)}</small></div>
                  </div>
                ))}
              </div>
            </section>

            <div className="live-source-note" style={{ marginTop: 18 }}>
              <ShieldCheck size={18} />
              <div>
                <strong>نعرض فقط ما هو متاح بدرجة ثقة واضحة.</strong>
                <span>خصائص الراحة المتقدمة التي تحتاج بيانات تشغيلية إضافية لن تظهر كأنها معلومات مؤكدة قبل اكتمال ربطها.</span>
              </div>
            </div>

            <div className={styles.actions}>
              <Link href={`/navigate?${tripQuery}&route=${route.id}`} className="primary-action"><Navigation size={18} />ابدأ الرحلة</Link>
            </div>
          </>
        )}
      </section>

      <section className={styles.map} aria-label="تفاصيل المسار على الخريطة">
        <div className="map-frame">
          <MapView routes={route ? [route] : []} selected={route?.id} showAll={false} origin={trip.origin} destination={trip.destination} />
          <div className="map-context"><strong>{route ? route.name : "جاري تجهيز المسار"}</strong><span>{trip.originLabel} ← {trip.destinationLabel}</span></div>
        </div>
      </section>
    </main>
  );
}
