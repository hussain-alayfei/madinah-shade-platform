import { Accessibility, Footprints, Navigation2, Route, Timer } from "lucide-react";
import { formatDistance, type LiveRoute } from "@/lib/maps";

export function RouteCard({ route, selected = false, onSelect, recommended = false }: { route: LiveRoute; selected?: boolean; onSelect?: () => void; recommended?: boolean }) {
  return (
    <button type="button" className={`route-card ${selected ? "is-selected" : ""}`} onClick={onSelect}>
      {recommended && <div className="route-card__recommendation"><strong>المقترح كبداية</strong><span>{route.profileReason}</span></div>}
      <div className="route-card__topline"><div><h3>{route.name}</h3><p>{route.description}</p></div><div className="comfort-score" aria-label={`مؤشر الملاءمة التجريبي ${route.comfortScore} من 100`}><strong>{route.comfortScore}</strong><span>ملاءمة*</span></div></div>
      <div className="route-card__summary"><strong>{route.durationMinutes} دقيقة</strong><span>{formatDistance(route.distanceMeters)}</span></div>
      <dl className="route-facts route-facts--live">
        <div><dt><Route size={17} /> المسار</dt><dd>فعلي</dd></div>
        <div><dt><Navigation2 size={17} /> التوجيهات</dt><dd>{route.maneuvers.length}</dd></div>
        <div><dt><Timer size={17} /> الزمن</dt><dd>{route.durationMinutes} د</dd></div>
        <div><dt><Footprints size={17} /> النمط</dt><dd>مشي</dd></div>
        <div><dt><Accessibility size={17} /> كرسي متحرك</dt><dd>{route.wheelchairAware ? "مراعى" : "حسب OSM"}</dd></div>
      </dl>
    </button>
  );
}
