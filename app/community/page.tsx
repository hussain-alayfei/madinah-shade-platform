import Link from "next/link";
import { Plus } from "lucide-react";
import { CommunityReports } from "@/components/CommunityReports";

export default function CommunityPage() {
  return (
    <main className="content-shell">
      <div className="city-topline">
        <div className="page-title" style={{ marginBottom: 0 }}>
          <h1>ملاحظات المجتمع</h1>
          <p>تجارب المشاة تساعد في كشف تغيرات المسار التي لا تظهر دائمًا في البيانات الرسمية.</p>
        </div>
        <Link href="/report" className="secondary-action">
          <Plus size={17} />
          إضافة ملاحظة
        </Link>
      </div>

      <div className="notice" style={{ marginBottom: 24 }}>
        التأكيد يعني أنك لاحظت الحالة نفسها مؤخرًا. لا تستخدمه للتصويت على أهمية المشكلة.
      </div>

      <CommunityReports />
    </main>
  );
}
