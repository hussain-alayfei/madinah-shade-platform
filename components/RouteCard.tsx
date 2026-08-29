import { Accessibility, Droplets, Footprints, Route as RouteIcon, SunMedium, UsersRound } from "lucide-react";
import type { RouteOption } from "@/lib/data";
import { formatDistance, formatDuration, type LiveRoute } from "@/lib/maps";

export function RouteCard({ route, selected=false, onSelect, comfortScore, recommended=false, reasons=[], liveRoute, loading=false, error="" }: { route:RouteOption; selected?:boolean; onSelect?:()=>void; comfortScore?:number; recommended?:boolean; reasons?:string[]; liveRoute?:LiveRoute|null; loading?:boolean; error?:string }) {
  const score=comfortScore??route.comfort; const disabled=!liveRoute&&!loading;
  return <button type="button" className={`route-card ${selected?"is-selected":""}`} onClick={onSelect} disabled={disabled}>
    {recommended&&liveRoute&&<div className="route-card__recommendation"><strong>الأنسب حسب إعداداتك</strong>{reasons.length>0&&<span>{reasons.join(" · ")}</span>}</div>}
    <div className="route-card__topline"><div><h3>{route.name}</h3><p>{route.description}</p></div><div className="comfort-score" aria-label={`تقدير الراحة ${score} من 100`}><strong>{score}</strong><span>راحة تقديرية</span></div></div>
    <div className="route-card__summary">{loading?<span className="route-live-status">جاري حساب المسار من OpenStreetMap…</span>:liveRoute?<><strong>{formatDuration(liveRoute.durationSeconds)}</strong><span>{formatDistance(liveRoute.distanceMeters)}</span><span className="route-source"><RouteIcon size={13}/> مسار فعلي</span></>:<span className="route-live-status is-error">{error||"تعذر حساب هذا المسار"}</span>}</div>
    <dl className="route-facts"><div><dt><SunMedium size={17}/> الظل</dt><dd>~{route.shade}%</dd></div><div><dt><Footprints size={17}/> الإجهاد</dt><dd>{route.heat}*</dd></div><div><dt><UsersRound size={17}/> الازدحام</dt><dd>{route.crowd}*</dd></div><div><dt><Accessibility size={17}/> الإتاحة</dt><dd>{route.accessible?"مفضل":"محدود"}</dd></div><div><dt><Droplets size={17}/> المياه</dt><dd>{route.waterStops}*</dd></div></dl>
  </button>;
}
