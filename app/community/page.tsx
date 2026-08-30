import Link from "next/link";
import { Plus } from "lucide-react";
import { CommunityReports } from "@/components/CommunityReports";

export default function CommunityPage() {
  return (
    <main className="content-shell">
      <div className="city-topline community-topline">
        <div className="page-title" style={{ marginBottom: 0 }}>
          <h1>ملاحظات المجتمع</h1>
          <p>ملاحظات المشاة تساعدنا نرصد التغيّرات اللي ما تظهر دائمًا في البيانات الرسمية.</p>
          <p className="community-guidance"><strong>عن التأكيد:</strong> استخدمه فقط إذا شفت الحالة بنفسك مؤخرًا.</p>
        </div>
        <Link href="/report" className="secondary-action community-add-action">
          <Plus size={17} />
          إضافة ملاحظة
        </Link>
      </div>

      <CommunityReports />
    </main>
  );
}
