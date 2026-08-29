import { Suspense } from "react";
import { ArrivalSummary } from "@/components/ArrivalSummary";

export default function ArrivalPage() {
  return (
    <Suspense fallback={<main className="content-shell content-shell--narrow"><div className="map-loading">جاري تجهيز ملخص الرحلة…</div></main>}>
      <ArrivalSummary />
    </Suspense>
  );
}
