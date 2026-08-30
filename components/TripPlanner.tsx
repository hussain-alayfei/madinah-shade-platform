"use client";

import { Check, ChevronDown, Clock3, LocateFixed, MapPin, Navigation, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { departureOptions, travelPreferences, type PreferenceId } from "@/lib/data";
import type { LatLng, LiveTrip } from "@/lib/maps";
import { tripToSearchParams } from "@/lib/maps";

type GeocodeResult = {
  label: string;
  fullLabel: string;
  lat: number;
  lon: number;
};

const activePreferences = new Set<PreferenceId>(["wheelchair", "senior"]);

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function TripPlanner() {
  const router = useRouter();
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("المسجد النبوي");
  const [time, setTime] = useState<(typeof departureOptions)[number]>("الآن");
  const [showNeeds, setShowNeeds] = useState(false);
  const [needs, setNeeds] = useState<PreferenceId[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");

  function toggleNeed(id: PreferenceId) {
    if (!activePreferences.has(id)) return;
    setNeeds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function getBrowserLocation() {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("هذا المتصفح لا يدعم تحديد الموقع."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
        (locationError) => {
          if (locationError.code === locationError.PERMISSION_DENIED) {
            reject(new Error("اسمح للموقع بالوصول إلى موقعك من إعدادات المتصفح ثم حاول مرة أخرى."));
          } else {
            reject(new Error("تعذر تحديد موقعك الآن. جرّب مرة أخرى أو اكتب نقطة البداية."));
          }
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    });
  }

  async function useMyLocation() {
    setError("");
    setLocating(true);
    try {
      const point = await getBrowserLocation();
      setCurrentLocation(point);
      setFrom("موقعي الحالي");
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : "تعذر تحديد موقعك.");
    } finally {
      setLocating(false);
    }
  }

  async function geocode(query: string): Promise<GeocodeResult> {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const payload = (await response.json().catch(() => null)) as { results?: GeocodeResult[]; error?: string } | null;
    if (!response.ok || !payload?.results?.[0]) throw new Error(payload?.error || `لم نجد موقعًا واضحًا باسم "${query}".`);
    return payload.results[0];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!from.trim() || !to.trim()) {
      setError("اكتب نقطة البداية والوجهة.");
      return;
    }
    setPlanning(true);
    try {
      let origin: LatLng;
      let originLabel = from.trim();
      if (from.trim() === "موقعي الحالي") {
        origin = currentLocation || (await getBrowserLocation());
        setCurrentLocation(origin);
        originLabel = "موقعي الحالي";
      } else {
        const result = await geocode(from.trim());
        origin = { lat: result.lat, lon: result.lon };
        originLabel = result.label;
        await wait(1100);
      }
      const destinationResult = await geocode(to.trim());
      const trip: LiveTrip = {
        origin,
        destination: { lat: destinationResult.lat, lon: destinationResult.lon },
        originLabel,
        destinationLabel: destinationResult.label,
        time,
        needs,
      };
      router.push(`/plan?${tripToSearchParams(trip).toString()}`);
    } catch (planningError) {
      setError(planningError instanceof Error ? planningError.message : "تعذر تجهيز الرحلة.");
    } finally {
      setPlanning(false);
    }
  }

  return (
    <form className="trip-planner" aria-labelledby="trip-title" onSubmit={handleSubmit}>
      <div className="trip-planner__intro">
        <h1 id="trip-title">إلى أين تريد أن تذهب؟</h1>
        <p>نبحث عن المكان، نحسب مسار مشي حقيقي، ثم نتابع موقعك أثناء الرحلة بعد موافقتك.</p>
      </div>
      <div className="planner-field">
        <div className="planner-field__label-row">
          <label htmlFor="from">نقطة البداية</label>
          <button type="button" className="field-inline-action" onClick={useMyLocation} disabled={locating}>
            <LocateFixed size={15} />{locating ? "جاري التحديد…" : "استخدم موقعي"}
          </button>
        </div>
        <div className="planner-input"><LocateFixed size={19} /><input id="from" value={from} onChange={(event) => { setFrom(event.target.value); if (event.target.value !== "موقعي الحالي") setCurrentLocation(null); }} autoComplete="off" /></div>
        {currentLocation && from === "موقعي الحالي" && <small className="field-success">تم تحديد موقع الجهاز بنجاح.</small>}
      </div>
      <div className="planner-field">
        <label htmlFor="to">الوجهة</label>
        <div className="planner-input"><MapPin size={19} /><input id="to" value={to} onChange={(event) => setTo(event.target.value)} autoComplete="off" /></div>
      </div>
      <fieldset className="planner-field">
        <legend>وقت الانطلاق</legend>
        <div className="time-options">
          {departureOptions.map((option) => {
            const available = option === "الآن";
            return (
              <button
                key={option}
                type="button"
                className={time === option ? "is-selected" : ""}
                onClick={() => available && setTime(option)}
                disabled={!available}
                title={available ? undefined : "يحتاج ربط محرك الحرارة والظل بالتنبؤ الزمني"}
              >
                <Clock3 size={16} />{option}{!available && <small>قريبًا</small>}
              </button>
            );
          })}
        </div>
        <small className="planner-capability-note">اختيار أفضل وقت حسب الحرارة والظل غير مفعّل حتى نربط مصدرًا فعليًا للتنبؤ، لذلك لن نغيّر النتيجة بأرقام وهمية.</small>
      </fieldset>
      <div className="planner-needs">
        <button type="button" className="planner-needs__toggle" aria-expanded={showNeeds} onClick={() => setShowNeeds((value) => !value)}>
          <span><SlidersHorizontal size={17} /> احتياجات الرحلة</span><span className="planner-needs__summary">{needs.length ? `${needs.length} محددة` : "اختياري"}<ChevronDown size={16} className={showNeeds ? "is-open" : ""} /></span>
        </button>
        {showNeeds && (
          <div className="planner-needs__options" aria-label="تخصيص احتياجات الرحلة">
            {travelPreferences.map((item) => {
              const selected = needs.includes(item.id);
              const available = activePreferences.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${selected ? "is-selected" : ""} ${!available ? "is-unavailable" : ""}`}
                  aria-pressed={selected}
                  onClick={() => toggleNeed(item.id)}
                  disabled={!available}
                  title={available ? undefined : "هذه الخاصية تحتاج طبقة بيانات تشغيلية غير موصولة بعد"}
                >
                  <span className="planner-needs__check">{selected && <Check size={14} />}</span>
                  <span><strong>{item.label}</strong><small>{available ? item.description : `${item.description} · يحتاج مصدر بيانات فعلي`}</small></span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {error && <div className="logic-error" role="alert">{error}</div>}
      <button type="submit" className="primary-action" disabled={planning || locating}><Navigation size={19} />{planning ? "جاري البحث وحساب المسار…" : "احسب مسار المشي"}</button>
      <p className="planner-note">
        بحث الأماكن: Nominatim · © OpenStreetMap contributors. المسار والمسافة والتوجيهات: Valhalla + OpenStreetMap. التتبع: GPS الجهاز. الظل والازدحام الحي غير موصولين حتى الآن.
      </p>
    </form>
  );
}
