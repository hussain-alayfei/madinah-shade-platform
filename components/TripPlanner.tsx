"use client";

import { Check, ChevronDown, CircleAlert, LocateFixed, MapPin, Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { travelPreferences, type PreferenceId } from "@/lib/data";
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

export function TripPlanner() {
  const router = useRouter();
  const [startMode, setStartMode] = useState<StartMode>("current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("المسجد النبوي");
  const [showNeeds, setShowNeeds] = useState(false);
  const [needs, setNeeds] = useState<PreferenceId[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [areaIssue, setAreaIssue] = useState<AreaIssue>(null);
  const availablePreferences = useMemo(
    () => travelPreferences.filter((item) => activePreferences.has(item.id)),
    [],
  );

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
    if (!response.ok || !payload?.results?.[0]) {
      throw new Error(payload?.error || `لم نجد موقعًا واضحًا باسم "${query}".`);
    }
    return payload.results[0];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAreaIssue(null);

    if (startMode === "search" && !from.trim()) {
      setError("اكتب نقطة البداية أو اختر مكانًا مقترحًا.");
      return;
    }
    if (!to.trim()) {
      setError("اكتب الوجهة أو اختر مكانًا مقترحًا.");
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
        time: "الآن",
        needs,
        originMode: startMode === "current" ? "current" : "selected",
      };
      router.push(`/plan?${tripToSearchParams(trip).toString()}`);
    } catch (planningError) {
      setError(planningError instanceof Error ? planningError.message : "تعذر تجهيز الرحلة.");
    } finally {
      setPlanning(false);
    }
  }

  const currentLocationReady = Boolean(currentLocation && isWithinMadinahServiceArea(currentLocation));

  return (
    <form className="journey-planner" aria-labelledby="trip-title" onSubmit={handleSubmit}>
      <header className="journey-planner__header">
        <h1 id="trip-title">إلى أين تمشي؟</h1>
        <p>اختر نقطتين داخل المدينة المنورة، وسنرتب لك طرق المشي المتاحة بوضوح.</p>
      </header>

      <div className="journey-points" aria-label="نقاط الرحلة">
        <section className="journey-point journey-point--origin">
          <span className="journey-point__marker" aria-hidden="true" />
          <div className="journey-point__body">
            <div className="journey-point__label">
              <span>نقطة البداية</span>
              <button
                type="button"
                className="journey-inline-action"
                onClick={() => changeStartMode(startMode === "current" ? "search" : "current")}
              >
                {startMode === "current" ? "اختيار نقطة أخرى" : "استخدام موقعي"}
              </button>
            </div>

            {startMode === "current" ? (
              <button
                type="button"
                className={`journey-location-value ${currentLocationReady ? "is-ready" : ""} ${areaIssue === "current" ? "is-outside" : ""}`}
                onClick={() => void useMyLocation()}
                disabled={locating}
              >
                <LocateFixed size={18} />
                <span>
                  <strong>
                    {locating
                      ? "جاري تحديد موقعك…"
                      : areaIssue === "current"
                        ? "موقعك خارج نطاق التجربة"
                        : currentLocationReady
                          ? "موقعي الحالي"
                          : "استخدم موقع هذا الجهاز"}
                  </strong>
                  <small>
                    {areaIssue === "current"
                      ? "اختر نقطة داخل المدينة المنورة للمتابعة"
                      : currentLocationReady
                        ? "تم تثبيت نقطة البداية من موقع الجهاز"
                        : "لن يُستخدم موقعك إلا بعد موافقتك"}
                  </small>
                </span>
              </button>
            ) : (
              <div className="journey-text-field">
                <MapPin size={18} />
                <input
                  id="from"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  placeholder="اكتب نقطة البداية"
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        </section>

        <span className="journey-points__connector" aria-hidden="true" />

        <section className="journey-point journey-point--destination">
          <span className="journey-point__marker" aria-hidden="true" />
          <div className="journey-point__body">
            <div className="journey-point__label"><span>الوجهة</span></div>
            <div className="journey-text-field">
              <MapPin size={18} />
              <input
                id="to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="اكتب وجهتك"
                autoComplete="off"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="journey-quick-places" aria-label="وجهات شائعة">
        <span>وجهات شائعة</span>
        <div>
          {madinahSuggestedPlaces.slice(0, 4).map((place) => (
            <button
              key={place}
              type="button"
              className={to === place ? "is-selected" : ""}
              onClick={() => setTo(place)}
            >
              {place}
            </button>
          ))}
        </div>
      </div>

      <div className="journey-options-bar">
        <div className="journey-option-static">
          <span>الانطلاق</span>
          <strong>الآن</strong>
        </div>
        <button
          type="button"
          className="journey-accessibility-toggle"
          aria-expanded={showNeeds}
          onClick={() => setShowNeeds((value) => !value)}
        >
          <span>
            <strong>خيارات الوصول</strong>
            <small>{needs.length ? `${needs.length} محددة` : "اختياري"}</small>
          </span>
          <ChevronDown size={16} className={showNeeds ? "is-open" : ""} />
        </button>
      </div>

      {showNeeds && (
        <div className="journey-accessibility-options" aria-label="خيارات الوصول">
          {availablePreferences.map((item) => {
            const selected = needs.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={selected ? "is-selected" : ""}
                aria-pressed={selected}
                onClick={() => toggleNeed(item.id)}
              >
                <span className="journey-check">{selected && <Check size={13} />}</span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            );
          })}
        </div>
      )}

      {areaIssue && (
        <div className="service-area-card journey-service-area" role="alert">
          <CircleAlert size={19} />
          <div>
            <strong>{areaIssue === "destination" ? "الوجهة خارج نطاق التجربة" : "نقطة البداية خارج نطاق التجربة"}</strong>
            <p>التجربة الحالية مخصصة للمشي داخل المدينة المنورة.</p>
            {areaIssue !== "destination" && startMode === "current" && (
              <button type="button" onClick={() => changeStartMode("search")}>اختيار نقطة داخل المدينة</button>
            )}
          </div>
        </div>
      )}

      {error && <div className="logic-error" role="alert">{error}</div>}

      <button type="submit" className="primary-action planner-submit journey-submit" disabled={planning || locating}>
        <Navigation size={18} />
        {planning ? "جاري تجهيز المسارات…" : "عرض المسارات"}
      </button>
    </form>
  );
}
