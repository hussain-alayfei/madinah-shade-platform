"use client";

import Link from "next/link";
import { Accessibility, Armchair, ArrowRight, Clock3, Droplets, Navigation, SunMedium, Toilet, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { bestDeparture, parseDepartureTime, parsePreferences, routeOptions } from "@/lib/data";
import { MapView } from "./MapView";
import styles from "./RouteDetails.module.css";

export function RouteDetails() {
  const params = useSearchParams();
  const routeId = params.get("route") ?? "comfortable";
  const route = routeOptions.find((item) => item.id === routeId) ?? routeOptions[0];
  const selectedTime = parseDepartureTime(params.get("time"));
  const needs = parsePreferences(params.get("needs"));
  const bestTime = bestDeparture(route);
  const needsQuery = needs.length ? `&needs=${needs.join(",")}` : "";

  return (
    <main className={styles.layout}>
      <section className={styles.details}>
        <div className={styles.back}>
          <Link href={`/plan?time=${encodeURIComponent(selectedTime)}${needsQuery}`} className="text-action">
            <ArrowRight size={16} />
            العودة للمسارات
          </Link>
        </div>

        <h1>{route.name}</h1>
        <p className={styles.description}>{route.description}</p>

        <div className={styles.summary}>
          <div>
            <span>المدة</span>
            <strong>{route.duration} دقيقة</strong>
          </div>
          <div>
            <span>المسافة</span>
            <strong>{route.distance} م</strong>
          </div>
          <div>
            <span>الراحة · {selectedTime}</span>
            <strong>{route.timeComfort[selectedTime]}/100</strong>
          </div>
        </div>

        <section className={styles.section}>
          <h2>حالة المسار المتوقعة</h2>
          <div className={styles.fact}>
            <span><SunMedium size={16} /> تغطية الظل</span>
            <strong>{route.shade}%</strong>
          </div>
          <div className={styles.fact}>
            <span><UsersRound size={16} /> الازدحام</span>
            <strong>{route.crowd}</strong>
          </div>
          <div className={styles.fact}>
            <span><Accessibility size={16} /> الإتاحة</span>
            <strong>{route.accessible ? "مناسب" : "محدود"}</strong>
          </div>
        </section>

        <section className={styles.section}>
          <h2>الخدمات على الطريق</h2>
          <div className={styles.services}>
            <div className={styles.service}><Droplets size={16} /> {route.waterStops} نقاط مياه</div>
            <div className={styles.service}><Armchair size={16} /> {route.restStops} مواقع استراحة</div>
            <div className={styles.service}><Toilet size={16} /> دورة مياه ضمن النطاق القريب</div>
          </div>
        </section>

        {bestTime.time !== selectedTime && (
          <div className="route-time-advice">
            <Clock3 size={17} />
            <div>
              <strong>وقت أريح متاح</strong>
              <span>عند {bestTime.time} ترتفع الراحة المتوقعة إلى {bestTime.score}/100.</span>
            </div>
          </div>
        )}

        <div className="notice" style={{ marginTop: 18 }}>
          {needs.length ? `تمت مراعاة ${needs.length} من احتياجات الرحلة. ` : ""}
          حالة الظل والازدحام تقديرية في هذه النسخة التجريبية، وقد تتغير أثناء الرحلة.
        </div>

        <div className={styles.actions}>
          <Link href={`/navigate?route=${route.id}&time=${encodeURIComponent(selectedTime)}${needsQuery}`} className="primary-action">
            <Navigation size={18} />
            ابدأ الرحلة
          </Link>
        </div>
      </section>

      <section className={styles.map} aria-label="تفاصيل المسار على الخريطة">
        <div className="map-frame">
          <MapView selected={route.id} showAll={false} />
          <div className="map-context">
            <strong>معاينة المسار</strong>
            <span>راجع الطريق والخدمات قبل الانطلاق.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
