"use client";

import Link from "next/link";
import { CheckCircle2, Flag, MessageSquareText, Route, SunMedium, Timer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { routeOptions } from "@/lib/data";

export function ArrivalSummary() {
  const params = useSearchParams();
  const routeId = params.get("route") ?? "comfortable";
  const route = routeOptions.find((item) => item.id === routeId) ?? routeOptions[0];
  const [rating, setRating] = useState<number | null>(null);

  return (
    <main className="content-shell content-shell--narrow">
      <div className="page-title">
        <CheckCircle2 size={34} color="#0f6b54" />
        <h1>وصلت إلى وجهتك</h1>
        <p>هذا الملخص يساعدك على تقييم الرحلة، ويساعد المنصة على مقارنة التوقعات بالتجربة الفعلية.</p>
      </div>

      <section className="arrival-summary" aria-label="ملخص الرحلة">
        <div className="arrival-stat">
          <Timer size={19} />
          <span>المدة</span>
          <strong>{route.duration} دقيقة</strong>
        </div>
        <div className="arrival-stat">
          <Route size={19} />
          <span>المسافة</span>
          <strong>{route.distance} م</strong>
        </div>
        <div className="arrival-stat">
          <SunMedium size={19} />
          <span>الظل المتوقع</span>
          <strong>{route.shade}%</strong>
        </div>
        <div className="arrival-stat">
          <Flag size={19} />
          <span>درجة الراحة</span>
          <strong>{route.comfort}/100</strong>
        </div>
      </section>

      <section className="feedback-section">
        <h2>كيف كانت الرحلة؟</h2>
        <p>اختر تقييمًا واحدًا. في النسخة التشغيلية سيُستخدم هذا التقييم لقياس دقة مؤشر الراحة.</p>
        <div className="rating-row" role="group" aria-label="تقييم الرحلة">
          {[
            [1, "مرهقة"],
            [2, "دون المتوقع"],
            [3, "مقبولة"],
            [4, "مريحة"],
            [5, "مريحة جدًا"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={rating === value ? "is-selected" : ""}
              onClick={() => setRating(value as number)}
            >
              <strong>{value}</strong>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {rating && (
          <div className="notice" style={{ marginTop: 16 }}>
            تم تسجيل تقييمك لهذه التجربة. شكرًا لمساهمتك في تحسين بيانات المسار.
          </div>
        )}
      </section>

      <div className="form-actions">
        <Link href="/" className="primary-action">رحلة جديدة</Link>
        <Link href="/report" className="secondary-action">
          <MessageSquareText size={17} />
          الإبلاغ عن ملاحظة
        </Link>
      </div>
    </main>
  );
}
