import { Suspense } from "react";
import { RouteDetails } from "@/components/RouteDetails";

export default function RoutePage() {
  return (
    <Suspense fallback={<main className="content-shell"><div className="map-loading">جاري تجهيز تفاصيل المسار…</div></main>}>
      <RouteDetails />
    </Suspense>
  );
}
