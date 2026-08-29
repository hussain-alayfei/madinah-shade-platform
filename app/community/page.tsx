import Link from "next/link";
import { Plus } from "lucide-react";
import { CommunityReports } from "@/components/CommunityReports";

export default function CommunityPage() {
  return <main className="content-shell"><div className="city-topline"><div className="page-title" style={{ marginBottom: 0 }}><h1>ملاحظات المجتمع</h1><p>بلاغاتك الجديدة تُحفظ محليًا وتبقى بعد تحديث الصفحة. البلاغات المشتركة بين جميع المستخدمين تحتاج Backend مشتركًا.</p></div><Link href="/report" className="secondary-action"><Plus size={17} />إضافة ملاحظة</Link></div><div className="notice" style={{ marginBottom: 24 }}>التأكيد يعني أنك لاحظت الحالة نفسها مؤخرًا. التأكيد محفوظ على هذا الجهاز ولا يُرسل لخادم مركزي حاليًا.</div><CommunityReports /></main>;
}
