import { ReportForm } from "@/components/ReportForm";

export default function ReportPage() {
  return <main className="content-shell content-shell--narrow"><div className="page-title"><h1>أرسل ملاحظة عن المسار</h1><p>يمكنك التقاط موقع GPS وإرفاق صورة. في هذه النسخة يُحفظ البلاغ على جهازك حتى نربط قاعدة بيانات مشتركة خاصة بالمشروع.</p></div><ReportForm /></main>;
}
