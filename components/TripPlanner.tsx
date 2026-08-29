"use client";

import { Check, ChevronDown, Clock3, LocateFixed, MapPin, Navigation, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { departureOptions, travelPreferences, type PreferenceId } from "@/lib/data";
import { buildTripQuery, geocodePlace, getBrowserLocation, type LatLng, type LocationFix } from "@/lib/maps";

export function TripPlanner() {
  const router = useRouter();
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("المسجد النبوي");
  const [time, setTime] = useState<(typeof departureOptions)[number]>("الآن");
  const [showNeeds, setShowNeeds] = useState(false);
  const [needs, setNeeds] = useState<PreferenceId[]>([]);
  const [originFix, setOriginFix] = useState<LocationFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");

  function toggleNeed(id: PreferenceId) {
    setNeeds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }
  async function locateMe() {
    setError(""); setLocating(true);
    try { const fix = await getBrowserLocation(); setOriginFix(fix); setFrom("موقعي الحالي"); }
    catch (locationError) { setOriginFix(null); setError((locationError as Error).message); }
    finally { setLocating(false); }
  }
  async function resolveOrigin(): Promise<{ point: LatLng; label: string }> {
    const text = from.trim();
    if (!text || text === "موقعي الحالي") {
      const fix = originFix ?? await getBrowserLocation();
      setOriginFix(fix);
      return { point: [fix.lat, fix.lon], label: "موقعي الحالي" };
    }
    const result = await geocodePlace(text);
    return { point: [result.lat, result.lon], label: text };
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!to.trim()) { setError("اكتب الوجهة التي تريد الذهاب إليها."); return; }
    setPlanning(true);
    try {
      const [origin, destination] = await Promise.all([
        resolveOrigin(),
        geocodePlace(to.trim()).then((result) => ({ point: [result.lat, result.lon] as LatLng, label: to.trim() })),
      ]);
      const query = buildTripQuery({ trip: { start: origin.point, end: destination.point, fromLabel: origin.label, toLabel: destination.label }, time, needs });
      router.push(`/plan?${query}`);
    } catch (planningError) { setError((planningError as Error).message || "تعذر تجهيز الرحلة."); }
    finally { setPlanning(false); }
  }

  return (
    <form className="trip-planner" aria-labelledby="trip-title" onSubmit={handleSubmit}>
      <div className="trip-planner__intro"><h1 id="trip-title">إلى أين تريد أن تذهب؟</h1><p>نحسب مسار المشي فعليًا من OpenStreetMap، ثم نضيف تفضيلات الراحة الخاصة بالرحلة.</p></div>
      <div className="planner-field">
        <div className="planner-label-row"><label htmlFor="from">نقطة البداية</label><button type="button" className="inline-location-action" onClick={locateMe} disabled={locating}><LocateFixed size={14} />{locating ? "جاري التحديد…" : originFix ? "تم تحديد GPS" : "استخدم موقعي"}</button></div>
        <div className="planner-input"><LocateFixed size={19} /><input id="from" value={from} onChange={(event) => { setFrom(event.target.value); if (event.target.value !== "موقعي الحالي") setOriginFix(null); }} autoComplete="off" /></div>
      </div>
      <div className="planner-field">
        <label htmlFor="to">الوجهة</label><div className="planner-input"><MapPin size={19} /><input id="to" value={to} onChange={(event) => setTo(event.target.value)} autoComplete="off" /></div>
        <small className="field-help">يتم البحث عند الضغط على عرض المسارات، وليس عبر اقتراحات تلقائية.</small>
      </div>
      <fieldset className="planner-field"><legend>وقت الانطلاق</legend><div className="time-options">{departureOptions.map((option) => <button key={option} type="button" className={time === option ? "is-selected" : ""} onClick={() => setTime(option)}><Clock3 size={16} />{option}</button>)}</div></fieldset>
      <div className="planner-needs">
        <button type="button" className="planner-needs__toggle" aria-expanded={showNeeds} onClick={() => setShowNeeds((value) => !value)}><span><SlidersHorizontal size={17} /> احتياجات الرحلة</span><span className="planner-needs__summary">{needs.length ? `${needs.length} محددة` : "اختياري"}<ChevronDown size={16} className={showNeeds ? "is-open" : ""} /></span></button>
        {showNeeds && <div className="planner-needs__options" aria-label="تخصيص احتياجات الرحلة">{travelPreferences.map((item) => { const selected = needs.includes(item.id); return <button key={item.id} type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} onClick={() => toggleNeed(item.id)}><span className="planner-needs__check">{selected && <Check size={14} />}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>; })}</div>}
      </div>
      {error && <div className="planner-status is-error" role="alert">{error}</div>}
      {originFix && <div className="planner-status" role="status">GPS جاهز · دقة تقريبية ±{Math.round(originFix.accuracy)} م</div>}
      <button type="submit" className="primary-action" disabled={planning || locating}><Navigation size={19} />{planning ? "جاري البحث وحساب المسارات…" : "عرض المسارات المناسبة"}</button>
      <p className="planner-note">المسافة والزمن والمسار تُحسب من بيانات OpenStreetMap. مؤشرات الظل والازدحام والراحة ما زالت تقديرية إلى أن تتوفر بيانات المدينة الحية.</p>
    </form>
  );
}
