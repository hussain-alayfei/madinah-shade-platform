"use client";

import Link from "next/link";
import { ArrowUp, CircleAlert, Flag } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { routeOptions } from "@/lib/data";
import { MapView } from "./MapView";

const steps = [
  { distance: "180 م", title: "استمر للأمام", note: "الجزء القادم مظلل بشكل جيد." },
  { distance: "90 م", title: "اتجه يسارًا عند التقاطع", note: "ازدحام منخفض في هذا المسار حاليًا." },
  { distance: "240 م", title: "استمر بمحاذاة الممر", note: "توجد نقطة مياه بعد 120 مترًا." },
  { distance: "120 م", title: "تابع مباشرة نحو الوجهة", note: "أنت قريب من نهاية الرحلة." },
];

export function NavigationExperience() {
  const params = useSearchParams();
  const routeId = params.get("route") ?? "comfortable";
  const route = routeOptions.find((item) => item.id === routeId) ?? routeOptions[0];
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 96) return value;
        const next = Math.min(value + 7, 96);
        const targetStep = Math.min(Math.floor((next / 100) * steps.length), steps.length - 1);
        setStepIndex(targetStep);
        return next;
      });
    }, 4200);

    return () => window.clearInterval(interval);
  }, []);

  const step = steps[stepIndex];
  const remaining = useMemo(() => Math.max(2, Math.round(route.duration * (1 - progress / 100))), [progress, route.duration]);

  return (
    <main className="navigation-shell">
      <section className="navigation-map" aria-label="الملاحة الحية">
        <div className="map-frame">
          <MapView selected={route.id} showAll={false} />
          <div className="map-context">
            <strong>{route.name}</strong>
            <span>تحديث تجريبي للمسار والتنبيهات أثناء المشي.</span>
          </div>
        </div>
      </section>

      <section className="navigation-sheet">
        <div className="navigation-sheet__inner">
          <div>
            <div className="nav-instruction">
              <div className="nav-instruction__icon">
                {progress > 90 ? <Flag size={28} /> : <ArrowUp size={29} />}
              </div>
              <div>
                <h1>{progress > 90 ? "الوجهة أمامك" : step.title}</h1>
                <p>{progress > 90 ? "بقيت خطوات قليلة للوصول." : `${step.distance} · ${step.note}`}</p>
              </div>
            </div>
            <div className="nav-progress" aria-label={`تقدم الرحلة ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div>
            <div className="nav-status">
              <div>
                <span>المتبقي</span>
                <strong>{remaining} د</strong>
              </div>
              <div>
                <span>الظل</span>
                <strong>{route.shade}%</strong>
              </div>
              <div>
                <span>الراحة</span>
                <strong>{route.comfort}</strong>
              </div>
            </div>
            {progress > 90 && (
              <Link href={`/arrival?route=${route.id}`} className="primary-action" style={{ marginTop: 10 }}>
                إنهاء الرحلة
              </Link>
            )}
          </div>
        </div>

        {progress > 44 && progress < 72 && (
          <div className="notice" style={{ width: "min(980px, 100%)", margin: "16px auto 0" }}>
            <CircleAlert size={16} style={{ verticalAlign: "middle", marginLeft: 7 }} />
            كثافة مشاة أعلى قليلًا بعد 300 متر. المسار الحالي ما زال الأفضل من ناحية الراحة.
          </div>
        )}
      </section>
    </main>
  );
}
