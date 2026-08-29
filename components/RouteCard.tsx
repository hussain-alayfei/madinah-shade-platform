import { Accessibility, Droplets, Footprints, SunMedium, UsersRound } from "lucide-react";
import type { RouteOption } from "@/lib/data";

export function RouteCard({
  route,
  selected = false,
  onSelect,
  comfortScore,
  recommended = false,
  reasons = [],
}: {
  route: RouteOption;
  selected?: boolean;
  onSelect?: () => void;
  comfortScore?: number;
  recommended?: boolean;
  reasons?: string[];
}) {
  const score = comfortScore ?? route.comfort;

  return (
    <button type="button" className={`route-card ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      {recommended && (
        <div className="route-card__recommendation">
          <strong>الأنسب لاحتياجاتك</strong>
          {reasons.length > 0 && <span>{reasons.join(" · ")}</span>}
        </div>
      )}

      <div className="route-card__topline">
        <div>
          <h3>{route.name}</h3>
          <p>{route.description}</p>
        </div>
        <div className="comfort-score" aria-label={`درجة الراحة ${score} من 100`}>
          <strong>{score}</strong>
          <span>راحة</span>
        </div>
      </div>

      <div className="route-card__summary">
        <strong>{route.duration} دقيقة</strong>
        <span>{route.distance} م</span>
      </div>

      <dl className="route-facts">
        <div>
          <dt><SunMedium size={17} /> الظل</dt>
          <dd>{route.shade}%</dd>
        </div>
        <div>
          <dt><Footprints size={17} /> الإجهاد</dt>
          <dd>{route.heat}</dd>
        </div>
        <div>
          <dt><UsersRound size={17} /> الازدحام</dt>
          <dd>{route.crowd}</dd>
        </div>
        <div>
          <dt><Accessibility size={17} /> الإتاحة</dt>
          <dd>{route.accessible ? "مناسب" : "محدود"}</dd>
        </div>
        <div>
          <dt><Droplets size={17} /> المياه</dt>
          <dd>{route.waterStops}</dd>
        </div>
      </dl>
    </button>
  );
}
