import { Suspense } from "react";
import { NavigationExperience } from "@/components/NavigationExperience";

export default function NavigatePage() {
  return (
    <Suspense fallback={<main className="navigation-shell"><div className="map-loading">جاري تجهيز الرحلة…</div></main>}>
      <NavigationExperience />
    </Suspense>
  );
}
