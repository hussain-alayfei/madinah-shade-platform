"use client";

import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { departureOptions, travelPreferences, type PreferenceId } from "@/lib/data";
import {
  isWithinMadinahServiceArea,
  madinahSuggestedPlaces,
  tripToSearchParams,
  type LatLng,
  type LiveTrip,
} from "@/lib/maps";

type GeocodeResult = {
  label: string;
  fullLabel: string;
  lat: number;
  lon: number;
};

type StartMode = "current" | "search";
type AreaIssue = "current" | "origin" | "destination" | null;

const activePreferences = new Set<PreferenceId>(["wheelchair", "senior"]);

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function TripPlanner() {
  const router = useRouter();
  const [startMode, setStartMode] = useState<StartMode>("current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("المسجد النبوي");
  const [time, setTime] = useState<(typeof departureOptions)[number]>("الآن");
  const [showNeeds, setShowNeeds] = useState(false);
  const [needs, setNeeds] = useState<PreferenceId[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [areaIssue, setAreaIssue] = useState<AreaIssue>(null);

  function toggleNeed(id: PreferenceId) {
    if (!activePreferences.has(id)) return;
    setNeeds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function changeStartMode(mode: StartMode) {
    setStartMode(mode);
    setError("");
    setAreaIssue(null);
    if (mode === "search" && !from) setFrom("المسجد النبوي");
  }

  function getBrowserLocation() {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("تحديد الموقع غير متاح على هذا الجهاز."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
        (locationError) => {
          if (locationError.code === locationError.PERMISSION_DENIED) {
            reject(new Error("فعّل إذن الموقع لهذا التطبيق ثم حاول مرة أخرى."));
          } else {
            reject(new Error("تعذر تحديد موقعك الآن. يمكنك اختيار نقطة بداية يدويًا."));
          }
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    });
  }

  async function useMyLocation() {
    setError("");
    setAreaIssue(null);
    setLocating(true);
    try {
      const point = await getBrowserLocation();
      setCurrentLocation(point);
      if (!isWithinMadinahServiceArea(point)) setAreaIssue("current");
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
    setAreaIssue(null);

    if (startMode === "search" && !from.trim()) {
      setError("اكتب نقطة البداية أو اختر واحدة من الاقتراحات.");
      return;
    }
    if (!to.trim()) {
      setError("اكتب الوجهة أو اختر واحدة من الاقتراحات.");
      return;
    }

    setPlanning(true);
    try {
      let origin: LatLng;
      let originLabel: string;

      if (startMode === "current") {
        origin = currentLocation || (await getBrowserLocation());
        setCurrentLocation(origin);
        originLabel = "موقعي الحالي";
        if (!isWithinMadinahServiceArea(origin)) {
          setAreaIssue("current");
          return;
        }
      } else {
        const result = await geocode(from.trim());
        origin = { lat: result.lat, lon: result.lon };
        originLabel = result.label;
        if (!isWithinMadinahServiceArea(origin)) {
          setAreaIssue("origin");
          return;
        }
        await wait(1100);
      }

      const destinationResult = await geocode(to.trim());
      const destination = { lat: destinationResult.lat, lon: destinationResult.lon };
      if (!isWithinMadinahServiceArea(destination)) {
        setAreaIssue("destination");
        return;
      }

      const trip: LiveTrip = {
        origin,
        destination,
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

  const currentLocationReady = currentLocation && isWithinMadinahServiceArea(currentLocation);

  return (
    <form className="trip-planner" aria-labelledby="trip-title" onSubmit={handleSubmit}>
      <div className="trip-planner__intro">
        <span className="app-eyebrow">المشي داخل المدينة المنورة</span>
        <h1 id="trip-title">خطّط مشوارك براحة أكثر</h1>
        <p>اختر نقطة البداية والوجهة، ثم نقارن لك طرق المشي المتاحة.</p>
      </div>

      <section className="planner-section" aria-labelledby="start-title">
        <div className="planner-section__heading">
          <div>
            <span className="planner-step">1</span>
            <h2 id="start-title">من أين تبدأ؟</h2>
          </div>
        </div>

        <div className="start-mode-control" role="group" aria-label="طريقة تحديد نقطة البداية">
          <button type="button" className={startMode === "current" ? "is-selected" : ""} onClick={() => changeStartMode("current")}>
            <LocateFixed size={17} /> موقعي الحالي
          </button>
          <button type="button" className={startMode === "search" ? "is-selected" : ""} onClick={() => changeStartMode("search")}>
            <Search size={17} /> اختيار نقطة
          </button>
        </div>

        {startMode === "current" ? (
          <div className={`current-location-card ${currentLocationReady ? "is-ready" : ""} ${areaIssue === "current" ? "is-outside" : ""}`}>
            <div className="current-location-card__icon"><LocateFixed size={21} /></div>
            <div className="current-location-card__copy">
              <strong>{areaIssue === "current" ? "موقعك الحالي خارج نطاق التجربة" : currentLocationReady ? "تم تحديد موقعك" : "استخدم موقع هذا الجهاز"}</strong>
              <span>{areaIssue === "current" ? "التجربة الحالية مخصصة للمشي داخل المدينة المنورة." : currentLocationReady ? "سيكون هذا هو موضع البداية ولا يمكن تحريره كنص." : "لن نستخدم موقعك إلا بعد موافقتك."}</span>
            </div>
            <button type="button" className="location-action" onClick={() => void useMyLocation()} disabled={locating}>
              {locating ? "جاري التحديد…" : currentLocation ? "تحديث" : "تحديد"}
            </button>
          </div>
        ) : (
          <>
            <div className="planner-input planner-input--app">
              <MapPin size={19} />
              <input id="from" value={from} onChange={(event) => setFrom(event.target.value)} placeholder="اكتب نقطة بداية داخل المدينة" autoComplete="off" />
            </div>
            <div className="place-suggestions" aria-label="نقاط بداية مقترحة">
              {madinahSuggestedPlaces.slice(0, 4).map((place) => (
                <button key={place} type="button" onClick={() => setFrom(place)}>{place}</button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="planner-section" aria-labelledby="destination-title">
        <div className="planner-section__heading">
          <div>
            <span className="planner-step">2</span>
            <h2 id="destination-title">إلى أين؟</h2>
          </div>
        </div>
        <div className="planner-input planner-input--app">
          <MapPin size={19} />
          <input id="to" value={to} onChange={(event) => setTo(event.target.value)} placeholder="اكتب وجهتك" autoComplete="off" />
        </div>
        <div className="place-suggestions" aria-label="وجهات مقترحة">
          {madinahSuggestedPlaces.slice(0, 4).map((place) => (
            <button key={place} type="button" className={to === place ? "is-selected" : ""} onClick={() => setTo(place)}>{place}</button>
          ))}
        </div>
      </section>

      <fieldset className="planner-field planner-field--compact">
        <legend>وقت الانطلاق</legend>
        <div className="time-options">
          {departureOptions.map((option) => {
            const available = option === "الآن";
            return (
              <button key={option} type="button" className={time === option ? "is-selected" : ""} onClick={() => available && setTime(option)} disabled={!available}>
                <Clock3 size={16} />{option}{!available && <small>قريبًا</small>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="planner-needs">
        <button type="button" className="planner-needs__toggle" aria-expanded={showNeeds} onClick={() => setShowNeeds((value) => !value)}>
          <span><SlidersHorizontal size={17} /> احتياجات الرحلة</span>
          <span className="planner-needs__summary">{needs.length ? `${needs.length} محددة` : "اختياري"}<ChevronDown size={16} className={showNeeds ? "is-open" : ""} /></span>
        </button>
        {showNeeds && (
          <div className="planner-needs__options" aria-label="تخصيص احتياجات الرحلة">
            {travelPreferences.map((item) => {
              const selected = needs.includes(item.id);
              const available = activePreferences.has(item.id);
              return (
                <button key={item.id} type="button" className={`${selected ? "is-selected" : ""} ${!available ? "is-unavailable" : ""}`} aria-pressed={selected} onClick={() => toggleNeed(item.id)} disabled={!available}>
                  <span className="planner-needs__check">{selected && <Check size={14} />}</span>
                  <span><strong>{item.label}</strong><small>{available ? item.description : "ستتوفر عند اكتمال بيانات هذه الخاصية."}</small></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {areaIssue && (
        <div className="service-area-card" role="alert">
          <CircleAlert size={20} />
          <div>
            <strong>{areaIssue === "destination" ? "الوجهة خارج نطاق التجربة" : "نقطة البداية خارج نطاق التجربة"}</strong>
            <p>نطاق التجربة الحالي داخل المدينة المنورة. اختر مكانًا داخل المدينة للمتابعة.</p>
            {areaIssue !== "destination" && startMode === "current" && (
              <button type="button" onClick={() => changeStartMode("search")}>اختيار نقطة بداية داخل المدينة</button>
            )}
          </div>
        </div>
      )}

      {error && <div className="logic-error" role="alert">{error}</div>}

      <button type="submit" className="primary-action planner-submit" disabled={planning || locating}>
        <Navigation size={19} />
        {planning ? "جاري تجهيز المسارات…" : "عرض مسارات المشي"}
      </button>
    </form>
  );
}
