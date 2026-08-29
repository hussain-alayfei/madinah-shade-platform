"use client";

import Link from "next/link";
import { Clock3, LocateFixed, MapPin, Navigation } from "lucide-react";
import { useState } from "react";

export function TripPlanner() {
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("المسجد النبوي");
  const [time, setTime] = useState("الآن");

  return (
    <section className="trip-planner" aria-labelledby="trip-title">
      <div className="trip-planner__intro">
        <h1 id="trip-title">إلى أين تريد أن تذهب؟</h1>
        <p>نقارن المسارات حسب الظل والحرارة والازدحام والإتاحة والخدمات المحيطة.</p>
      </div>

      <div className="planner-field">
        <label htmlFor="from">نقطة البداية</label>
        <div className="planner-input">
          <LocateFixed size={19} />
          <input id="from" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
      </div>

      <div className="planner-field">
        <label htmlFor="to">الوجهة</label>
        <div className="planner-input">
          <MapPin size={19} />
          <input id="to" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      <fieldset className="planner-field">
        <legend>وقت الانطلاق</legend>
        <div className="time-options">
          {["الآن", "5:00 م", "6:00 م"].map((option) => (
            <button
              key={option}
              type="button"
              className={time === option ? "is-selected" : ""}
              onClick={() => setTime(option)}
            >
              <Clock3 size={16} />
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <Link href="/plan" className="primary-action">
        <Navigation size={19} />
        عرض المسارات المناسبة
      </Link>

      <p className="planner-note">البيانات في هذه النسخة تجريبية لعرض تجربة المنتج.</p>
    </section>
  );
}
