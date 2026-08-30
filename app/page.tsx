import { MapView } from "@/components/MapView";
import { TripPlanner } from "@/components/TripPlanner";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-panel">
        <TripPlanner />
      </section>

      <section className="home-map" aria-label="خريطة المدينة المنورة">
        <div className="map-frame">
          <MapView selected="comfortable" showAll={false} />
          <div className="map-context">
            <strong>المدينة المنورة</strong>
            <span>ابدأ بتحديد نقطة البداية والوجهة لعرض مسارات المشي.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
