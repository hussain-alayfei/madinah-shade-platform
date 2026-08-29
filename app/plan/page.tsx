import { Suspense } from "react";
import { RoutePlannerView } from "@/components/RoutePlannerView";

export default function PlanPage() {
  return (
    <Suspense fallback={<main className="plan-shell"><div className="map-loading">جاري تجهيز المسارات المناسبة…</div></main>}>
      <RoutePlannerView />
    </Suspense>
  );
}
