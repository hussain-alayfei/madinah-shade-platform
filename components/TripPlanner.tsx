"use client";

import Link from "next/link";
import { Check, ChevronDown, Clock3, LocateFixed, MapPin, Navigation, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { departureOptions, travelPreferences, type PreferenceId } from "@/lib/data";

export function TripPlanner() {
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("المسجد النبوي");
  const [time, setTime] = useState<(typeof departureOptions)[number]>("الآن");
  const [showNeeds, setShowNeeds] = useState(false);
  const [needs, setNeeds] = useState<PreferenceId[]>([]);

  function toggleNeed(id: PreferenceId) {
    setNeeds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const planHref = `/plan?time=${encodeURIComponent(time)}${needs.length ? `&needs=${needs.join(",")}` : ""}`;

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
          {departureOptions.map((option) => (
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

      <div className="planner-needs">
        <button
          type="button"
          className="planner-needs__toggle"
          aria-expanded={showNeeds}
          onClick={() => setShowNeeds((value) => !value)}
        >
          <span><SlidersHorizontal size={17} /> احتياجات الرحلة</span>
          <span className="planner-needs__summary">
            {needs.length ? `${needs.length} محددة` : "اختياري"}
            <ChevronDown size={16} className={showNeeds ? "is-open" : ""} />
          </span>
        </button>

        {showNeeds && (
          <div className="planner-needs__options" aria-label="تخصيص احتياجات الرحلة">
            {travelPreferences.map((item) => {
              const selected = needs.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={selected ? "is-selected" : ""}
                  aria-pressed={selected}
                  onClick={() => toggleNeed(item.id)}
                >
                  <span className="planner-needs__check">{selected && <Check size={14} />}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Link href={planHref} className="primary-action">
        <Navigation size={19} />
        عرض المسارات المناسبة
      </Link>

      <p className="planner-note">البيانات في هذه النسخة تجريبية لعرض تجربة المنتج.</p>
    </section>
  );
}
