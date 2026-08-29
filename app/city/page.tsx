import { Accessibility, AlertTriangle, BarChart3, Droplets, Footprints, Layers3, Map, UsersRound } from "lucide-react";
import { CityMapView } from "@/components/CityMapView";
import { cityPriorities } from "@/lib/data";

const sidebarItems = [
  { label: "نظرة عامة", icon: BarChart3, active: true },
  { label: "الخريطة", icon: Map },
  { label: "الإجهاد الحراري", icon: Footprints },
  { label: "الازدحام", icon: UsersRound },
  { label: "الإتاحة", icon: Accessibility },
  { label: "الخدمات", icon: Droplets },
  { label: "البلاغات", icon: AlertTriangle },
  { label: "التدخلات", icon: Layers3 },
];

export default function CityDashboardPage() {
  return (
    <main className="city-layout">
      <aside className="city-sidebar">
        <h2>لوحة المدينة</h2>
        <nav aria-label="أقسام لوحة المدينة">
          {sidebarItems.map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={active ? "is-active" : ""}>
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="city-main">
        <div className="city-topline">
          <div>
            <h1>حالة نطاق التجربة</h1>
            <p>قراءة تشغيلية للراحة، الحركة، الإتاحة والخدمات في النطاق التجريبي.</p>
          </div>
          <select className="city-filter" defaultValue="today" aria-label="الفترة الزمنية">
            <option value="today">اليوم</option>
            <option value="week">آخر 7 أيام</option>
            <option value="month">آخر 30 يومًا</option>
          </select>
        </div>

        <div className="city-overview">
          <div className="city-map-panel">
            <CityMapView />
          </div>

          <div className="city-sidepanel">
            <div className="city-metrics">
              <div className="city-metric">
                <span>متوسط الراحة</span>
                <strong>78</strong>
              </div>
              <div className="city-metric">
                <span>بلاغات نشطة</span>
                <strong>126</strong>
              </div>
              <div className="city-metric">
                <span>نقاط أولوية عالية</span>
                <strong>18</strong>
              </div>
              <div className="city-metric">
                <span>مشاركات متحقق منها</span>
                <strong>71%</strong>
              </div>
            </div>

            <div className="priority-list">
              <h2>أعلى أولويات التدخل</h2>
              {cityPriorities.map((item) => (
                <div className="priority-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.issue} · {item.reports} ملاحظة</span>
                  </div>
                  <div className="priority-score">{item.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="dashboard-section">
          <h2>المؤشرات التشغيلية</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>المؤشر</th>
                  <th>الحالة الحالية</th>
                  <th>مقارنة بخط الأساس</th>
                  <th>ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>المسارات ذات الراحة العالية</td>
                  <td>64%</td>
                  <td>+8%</td>
                  <td>تحسن في فترات ما بعد العصر</td>
                </tr>
                <tr>
                  <td>المرور عبر نقاط الاختناق</td>
                  <td>21%</td>
                  <td>-5%</td>
                  <td>استجابة أفضل للمسارات البديلة</td>
                </tr>
                <tr>
                  <td>الملاحظات المتحقق منها</td>
                  <td>71%</td>
                  <td>+11%</td>
                  <td>نشاط مجتمعي أعلى هذا الأسبوع</td>
                </tr>
                <tr>
                  <td>زمن الرصد إلى الإجراء</td>
                  <td>19 ساعة</td>
                  <td>-3 ساعات</td>
                  <td>تحسن في معالجة مشكلات الخدمات</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
