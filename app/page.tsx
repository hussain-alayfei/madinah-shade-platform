import { MapView } from "@/components/MapView";
import { TripPlanner } from "@/components/TripPlanner";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-panel"><TripPlanner /></section>
      <section className="home-map" aria-label="خريطة مسارات المشاة">
        <div className="map-frame">
          <MapView showAll={false} />
          <div className="map-context"><strong>خريطة حقيقية</strong><span>استخدم زر «موقعي» أو ابحث عن وجهة لبدء حساب مسار المشي.</span></div>
        </div>
      </section>
    </main>
  );
}
